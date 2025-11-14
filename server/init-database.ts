import { db } from "./db";
import { sql } from "drizzle-orm";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

// 동시 실행 방지를 위한 플래그
let isInitializing = false;
let initPromise: Promise<void> | null = null;

/**
 * 런타임 데이터베이스 초기화
 * 배포 시 테이블이 없어도 자동 생성
 */
export async function ensureDatabaseInitialized() {
  // 동시 실행 방지: 이미 초기화 중이면 기존 Promise 반환
  if (isInitializing && initPromise) {
    console.log("⏳ 데이터베이스 초기화가 이미 진행 중입니다. 대기 중...");
    return initPromise;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      console.log("🔍 데이터베이스 초기화 확인 중...");
      console.log("✅ DATABASE_URL이 설정되어 있습니다.");

    // 모든 필수 테이블 존재 확인
    const requiredTables = ['users', 'form_templates', 'inbound_list', 'unipass_cargo_data', 'manifest_results', 'session'];
    
    const tableCheck = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY(${requiredTables})
    `);

    const existingTables = (tableCheck.rows as any[]).map(row => row.table_name);
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));

    if (missingTables.length > 0) {
      console.log(`⚠️ 누락된 테이블 감지: ${missingTables.join(', ')} → 테이블 생성 중...`);

      // 먼저 user_role ENUM 타입 생성
      console.log("📦 user_role ENUM 타입 생성 중...");
      await db.execute(sql`
        DO $$ BEGIN
          CREATE TYPE user_role AS ENUM ('user', 'admin');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);
      console.log("✅ user_role ENUM 타입 생성 완료");

      // users 테이블 생성
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role user_role NOT NULL DEFAULT 'user',
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // user_role enum이 없으면 생성
      await db.execute(sql`
        DO $$ BEGIN
          CREATE TYPE user_role AS ENUM ('user', 'admin');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      // form_templates 테이블 생성
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS form_templates (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          structure JSONB NOT NULL,
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // inbound_list 테이블 생성
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS inbound_list (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          반입번호 TEXT,
          no TEXT,
          도착_time TEXT,
          출발_time TEXT,
          도착예정_time TEXT,
          bl_no TEXT,
          item_no TEXT,
          dept TEXT,
          description TEXT,
          qty TEXT,
          qty_이상유무 TEXT,
          container_cntr_no TEXT,
          container_seal_no TEXT,
          container_temp TEXT,
          container_파손유무 TEXT,
          pallet_qty TEXT,
          mpk TEXT,
          box TEXT,
          unit TEXT,
          pallet_type TEXT,
          제품확인_블록 TEXT,
          제품확인_coo TEXT,
          제품확인_remark TEXT,
          수작업_유형 TEXT,
          차량번호 TEXT,
          비고 TEXT,
          구분 TEXT,
          수입자 TEXT,
          costco_bl_no TEXT,
          tie TEXT,
          높이 TEXT,
          반입일자 DATE,
          plt TEXT,
          매수 TEXT
        );
      `);

      // unipass_cargo_data 테이블 생성
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS unipass_cargo_data (
          id SERIAL PRIMARY KEY,
          inbound_list_id INTEGER REFERENCES inbound_list(id) ON DELETE CASCADE,
          carg_mt_no TEXT,
          mbl_no TEXT,
          hbl_no TEXT,
          cscl_prgs_stts TEXT,
          prgs_stts TEXT,
          prnm TEXT,
          pck_gcnt INTEGER,
          pck_ut TEXT,
          ttwg DECIMAL,
          wght_ut TEXT,
          msrm DECIMAL,
          shco_flco TEXT,
          carg_tp TEXT,
          prcs_dttm TEXT,
          ship_nat_nm TEXT,
          ship_nat TEXT,
          ship_nm TEXT,
          bl_pt_nm TEXT,
          bl_pt TEXT,
          cntr_gcnt INTEGER,
          cntr_no TEXT,
          dspr_nm TEXT,
          dspr_cd TEXT,
          etpr_dt TEXT,
          ldpr_nm TEXT,
          ldpr_cd TEXT,
          lod_cnty_cd TEXT,
          mt_trgt_carg_yn_nm TEXT,
          rlse_dty_prid_pass_tpcd TEXT,
          spcn_carg_cd TEXT,
          agnc TEXT,
          etpr_cstm TEXT,
          vydf TEXT,
          dclr_dely_adtx_yn TEXT,
          frwr_ents_conm TEXT,
          raw_payload JSONB,
          api_source TEXT NOT NULL,
          query_date TIMESTAMP NOT NULL DEFAULT NOW(),
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // manifest_results 테이블 생성
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS manifest_results (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          inbound_list_id INTEGER REFERENCES inbound_list(id) ON DELETE CASCADE,
          품명 TEXT NOT NULL,
          수량 TEXT NOT NULL,
          중량 TEXT,
          입항일자 TEXT,
          cont_no TEXT,
          화물종류 TEXT,
          dry_wet TEXT,
          수출국명 TEXT,
          선명 TEXT,
          검역사항 TEXT,
          경유지 TEXT,
          bl_no TEXT NOT NULL,
          화물관리번호 TEXT,
          수입자 TEXT,
          반입일자 DATE,
          plt TEXT,
          bl수량 TEXT,
          tie TEXT,
          sell_unit_per_case TEXT,
          do TEXT,
          item_no TEXT NOT NULL,
          수량_pcs TEXT,
          높이 TEXT,
          소비기한 TEXT,
          특이사항 TEXT,
          costco_bl_no TEXT,
          매수 TEXT,
          pallet_qty TEXT,
          mbl_no TEXT,
          hbl_no TEXT,
          cscl_prgs_stts TEXT,
          prgs_stts TEXT,
          prcs_dttm TEXT,
          prnm TEXT,
          pck_gcnt TEXT,
          pck_ut TEXT,
          ttwg TEXT,
          wght_ut TEXT,
          msrm TEXT,
          carg_tp TEXT,
          ship_nm TEXT,
          ship_nat_nm TEXT,
          ship_nat TEXT,
          shco_flco TEXT,
          agnc TEXT,
          vydf TEXT,
          etpr_dt TEXT,
          etpr_cstm TEXT,
          ldpr_nm TEXT,
          ldpr_cd TEXT,
          dspr_nm TEXT,
          dspr_cd TEXT,
          lod_cnty_cd TEXT,
          cntr_gcnt TEXT,
          cntr_no TEXT,
          bl_pt_nm TEXT,
          bl_pt TEXT,
          spcn_carg_cd TEXT,
          mt_trgt_carg_yn_nm TEXT,
          rlse_dty_prid_pass_tpcd TEXT,
          dclr_dely_adtx_yn TEXT,
          frwr_ents_conm TEXT,
          source_api TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // session 테이블 생성 (connect-pg-simple용)
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS session (
          sid VARCHAR NOT NULL COLLATE "default",
          sess JSON NOT NULL,
          expire TIMESTAMP(6) NOT NULL
        )
        WITH (OIDS=FALSE);
        
        ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
        
        CREATE INDEX IF NOT EXISTS IDX_session_expire ON session(expire);
      `);

      console.log("✅ 모든 테이블이 생성되었습니다.");
    } else {
      console.log(`✅ 모든 필수 테이블이 존재합니다: ${existingTables.join(', ')}`);
      
      // manifest_results 테이블이 없으면 별도로 생성 시도
      if (!existingTables.includes('manifest_results')) {
        console.log("⚠️ manifest_results 테이블이 없습니다. 생성 중...");
        try {
          await db.execute(sql`
            CREATE TABLE IF NOT EXISTS manifest_results (
              id SERIAL PRIMARY KEY,
              user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
              inbound_list_id INTEGER REFERENCES inbound_list(id) ON DELETE CASCADE,
              품명 TEXT NOT NULL,
              수량 TEXT NOT NULL,
              중량 TEXT,
              입항일자 TEXT,
              cont_no TEXT,
              화물종류 TEXT,
              dry_wet TEXT,
              수출국명 TEXT,
              선명 TEXT,
              검역사항 TEXT,
              경유지 TEXT,
              bl_no TEXT NOT NULL,
              화물관리번호 TEXT,
              수입자 TEXT,
              반입일자 DATE,
              plt TEXT,
              bl수량 TEXT,
              tie TEXT,
              sell_unit_per_case TEXT,
              do TEXT,
              item_no TEXT NOT NULL,
              수량_pcs TEXT,
              높이 TEXT,
              소비기한 TEXT,
              특이사항 TEXT,
              costco_bl_no TEXT,
              매수 TEXT,
              pallet_qty TEXT,
              mbl_no TEXT,
              hbl_no TEXT,
              cscl_prgs_stts TEXT,
              prgs_stts TEXT,
              prcs_dttm TEXT,
              prnm TEXT,
              pck_gcnt TEXT,
              pck_ut TEXT,
              ttwg TEXT,
              wght_ut TEXT,
              msrm TEXT,
              carg_tp TEXT,
              ship_nm TEXT,
              ship_nat_nm TEXT,
              ship_nat TEXT,
              shco_flco TEXT,
              agnc TEXT,
              vydf TEXT,
              etpr_dt TEXT,
              etpr_cstm TEXT,
              ldpr_nm TEXT,
              ldpr_cd TEXT,
              dspr_nm TEXT,
              dspr_cd TEXT,
              lod_cnty_cd TEXT,
              cntr_gcnt TEXT,
              cntr_no TEXT,
              bl_pt_nm TEXT,
              bl_pt TEXT,
              spcn_carg_cd TEXT,
              mt_trgt_carg_yn_nm TEXT,
              rlse_dty_prid_pass_tpcd TEXT,
              dclr_dely_adtx_yn TEXT,
              frwr_ents_conm TEXT,
              source_api TEXT,
              created_at TIMESTAMP NOT NULL DEFAULT NOW()
            );
          `);
          console.log("✅ manifest_results 테이블 생성 완료");
        } catch (error: any) {
          console.error("❌ manifest_results 테이블 생성 실패:", error?.message || error);
        }
      }
    }

    // 초기 사용자 데이터 확인 및 추가
    const initialUsers = [
      { username: "admin", password: "admin123", role: "admin" },
      { username: "바바", password: "123", role: "user" },
      { username: "하재훈", password: "123", role: "user" },
      { username: "양승화", password: "123", role: "user" },
    ];

    console.log("🔍 초기 사용자 데이터 확인 중...");
    let addedCount = 0;

    for (const userData of initialUsers) {
      try {
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.username, userData.username))
          .limit(1);

        if (!existingUser) {
          console.log(`⚠️ 사용자 '${userData.username}' 없음 → 추가 중...`);
          
          const passwordHash = await bcrypt.hash(userData.password, 12);
          
          // INSERT ... ON CONFLICT DO NOTHING으로 중복 방지
          await db.execute(sql`
            INSERT INTO users (username, password_hash, role)
            VALUES (${userData.username}, ${passwordHash}, ${userData.role}::user_role)
            ON CONFLICT (username) DO NOTHING
          `);
          
          // 다시 확인하여 실제로 추가되었는지 확인
          const [newUser] = await db
            .select()
            .from(users)
            .where(eq(users.username, userData.username))
            .limit(1);
          
          if (newUser) {
            console.log(`✅ 사용자 추가됨: ${userData.username} (비밀번호: ${userData.password})`);
            addedCount++;
          } else {
            console.log(`ℹ️ 사용자 '${userData.username}'은(는) 다른 프로세스에 의해 이미 추가되었습니다.`);
          }
        } else {
          console.log(`✅ 사용자 '${userData.username}' 이미 존재합니다.`);
        }
      } catch (error: any) {
        // 중복 키 에러는 무시 (다른 프로세스가 이미 추가했을 수 있음)
        if (error?.code === '23505') {
          console.log(`ℹ️ 사용자 '${userData.username}'은(는) 이미 존재합니다 (중복 키 무시).`);
        } else {
          console.error(`❌ 사용자 '${userData.username}' 추가 실패:`, error?.message || error);
          throw error;
        }
      }
    }

    if (addedCount > 0) {
      console.log(`✅ 총 ${addedCount}명의 초기 사용자 데이터가 추가됨`);
    } else {
      console.log("✅ 모든 초기 사용자 데이터가 이미 존재합니다.");
    }

      console.log("✅ 데이터베이스 초기화 완료");
    } catch (error: any) {
      console.error("❌ 데이터베이스 초기화 실패:", error);
      console.error("상세 에러:", {
        message: error?.message,
        code: error?.code,
        stack: error?.stack?.split('\n').slice(0, 5).join('\n'),
      });
      throw error;
    } finally {
      isInitializing = false;
      initPromise = null;
    }
  })();

  return initPromise;
}

// 스크립트로 직접 실행 가능하도록 (npm run db:init로 실행될 때만)
// import.meta.url과 process.argv[1]을 비교하여 직접 실행 여부 확인
const isDirectExecution = import.meta.url === `file://${process.argv[1]}` || 
                         process.argv[1]?.includes('init-database') ||
                         process.argv[1]?.endsWith('init-database.ts') ||
                         process.argv[1]?.endsWith('init-database.js');

if (isDirectExecution && !process.env.RENDER) {
  // Render 환경이 아니고 직접 실행될 때만 process.exit 호출
  ensureDatabaseInitialized()
    .then(() => {
      console.log("✅ 데이터베이스 초기화 스크립트 완료");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ 데이터베이스 초기화 스크립트 실패:", error);
      process.exit(1);
    });
}

