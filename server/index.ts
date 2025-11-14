import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// 세션 타입 확장
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
    role?: 'user' | 'admin';
  }
}

// 세션 스토어 설정 (connect-pg-simple)
const PgSession = ConnectPgSimple(session);

// Trust proxy in production (for secure cookies behind reverse proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// 세션 미들웨어 (registerRoutes 전에 설정)
app.use(
  session({
    store: new PgSession({
      pool: pool as any, // connect-pg-simple expects pg.Pool
      tableName: 'session', // 자동으로 생성됨
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // 프로덕션 환경에서 데이터베이스 초기화 (서버 시작 전에 완료)
  if (process.env.NODE_ENV === "production") {
    try {
      console.log("🔧 프로덕션 환경: 데이터베이스 초기화 시작...");
      
      if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL 환경 변수가 설정되지 않았습니다.");
      }
      
      console.log("✅ DATABASE_URL이 설정되어 있습니다.");
      console.log(`📊 DATABASE_URL: ${process.env.DATABASE_URL.substring(0, 30)}...`);
      
      // 런타임 데이터베이스 초기화 (테이블 생성 및 초기 데이터)
      const { ensureDatabaseInitialized } = await import("./init-database");
      await Promise.race([
        ensureDatabaseInitialized(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("DB 초기화 타임아웃 (60초)")), 60000)
        )
      ]);
      
      console.log("✅ 데이터베이스 초기화 완료 - 서버 시작");
    } catch (error: any) {
      console.error("❌ 데이터베이스 초기화 실패:", error?.message || error);
      console.error("⚠️ 서버는 계속 실행되지만 데이터베이스 기능이 작동하지 않을 수 있습니다.");
      console.error("💡 수동 초기화: Render Shell에서 'npm run db:init' 실행");
      // 에러가 발생해도 서버는 계속 실행 (수동으로 초기화 가능)
    }
  }

  // 초기 관리자 계정 생성
  try {
    await import("./init-admin");
  } catch (error: any) {
    console.error("⚠️ 관리자 계정 초기화 실패:", error?.message || error);
  }
  
  // Keep-Alive 시작 (프로덕션만)
  if (process.env.NODE_ENV === "production") {
    const { startKeepAlive } = await import("./keep-alive");
    startKeepAlive();
  }
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // Render는 PORT 환경 변수를 제공하므로 반드시 사용해야 함
  if (!process.env.PORT) {
    console.warn("⚠️ PORT 환경 변수가 설정되지 않았습니다. 기본값 5000을 사용합니다.");
  }
  
  server.listen(port, "0.0.0.0", () => {
    log(`✅ 서버가 포트 ${port}에서 실행 중입니다`);
    console.log(`✅ 서버가 포트 ${port}에서 실행 중입니다`);
    
    // 프로덕션 환경에서 데이터베이스 초기화 상태 확인
    if (process.env.NODE_ENV === "production") {
      console.log("✅ 데이터베이스 초기화는 백그라운드에서 진행 중입니다...");
    }
  });
})();
