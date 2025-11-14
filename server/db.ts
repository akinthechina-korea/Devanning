import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import * as schema from "@shared/schema";
import ws from "ws";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Render Internal DATABASE_URL을 External URL로 자동 변환
// dpg-xxx-a → dpg-xxx-a.singapore-postgres.render.com
function convertDatabaseUrl(url: string): string {
  // 이미 전체 도메인이 포함된 경우 그대로 반환
  if (url.includes('.render.com') || url.includes('.neon.tech') || url.includes('localhost')) {
    return url;
  }
  
  // Internal URL 패턴 감지: postgresql://user:pass@dpg-xxx-a/dbname
  const internalPattern = /postgresql:\/\/([^:]+):([^@]+)@(dpg-[a-z0-9]+-[a-z])/;
  const match = url.match(internalPattern);
  
  if (match) {
    const [, user, password, hostPrefix] = match;
    // External URL로 변환
    const externalUrl = url.replace(
      `@${hostPrefix}`,
      `@${hostPrefix}.singapore-postgres.render.com`
    );
    console.log(`✅ DATABASE_URL 변환: Internal → External`);
    return externalUrl;
  }
  
  return url;
}

const databaseUrl = convertDatabaseUrl(process.env.DATABASE_URL);

// Configure WebSocket for Neon
neonConfig.webSocketConstructor = ws;

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });
