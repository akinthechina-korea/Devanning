import { db } from "./db";
import { sql } from "drizzle-orm";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

/**
 * 런타임 데이터베이스 초기화
 * 배포 시 테이블이 없어도 자동 생성
 */
export async function ensureDatabaseInitialized() {
  try {
    console.log("🔍 데이터베이스 초기화 확인 중...");

    // users 테이블 존재 확인
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    const usersTableExists = (tableCheck.rows[0] as any)?.exists;

    if (!usersTableExists) {
      console.log("⚠️ 누락된 테이블 감지 → 테이블 생성 중...");

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
      console.log("✅ 데이터베이스 테이블이 이미 존재합니다.");
    }

    // 초기 사용자 데이터 확인 및 추가
    const [existingAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.username, "admin"))
      .limit(1);

    if (!existingAdmin) {
      console.log("⚠️ 초기 사용자 데이터 없음 → 추가 중...");
      
      const passwordHash = await bcrypt.hash("admin123", 12);
      
      await db.insert(users).values({
        username: "admin",
        passwordHash,
        role: "admin",
      });

      console.log("✅ 초기 사용자 데이터가 추가됨");
      console.log("  Username: admin");
      console.log("  Password: admin123");
    } else {
      console.log("✅ 초기 사용자 데이터가 이미 존재합니다.");
    }

    console.log("✅ 데이터베이스 초기화 완료");
  } catch (error) {
    console.error("❌ 데이터베이스 초기화 실패:", error);
    throw error;
  }
}

