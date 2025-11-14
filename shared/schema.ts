import { z } from "zod";
import { pgTable, serial, text, integer, decimal, timestamp, varchar, date, json, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// 사용자 역할 enum
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

// 사용자 테이블
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const selectUserSchema = createInsertSchema(users).omit({ passwordHash: true }); // 비밀번호 제외
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type SafeUser = Omit<User, "passwordHash">; // 비밀번호 제외한 안전한 타입

// 양식 템플릿 테이블 (이미지 기반) - 관리자만 관리
export const formTemplates = pgTable("form_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  structure: json("structure").notNull(), // TemplateStructure 타입
  isDefault: integer("is_default").default(0).notNull(), // 기본 양식 여부 (0 or 1)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 이미지 기반 템플릿 구조
export const templateFieldSchema = z.object({
  id: z.string(), // 필드 고유 ID
  x: z.number(), // X 좌표
  y: z.number(), // Y 좌표
  width: z.number(), // 너비
  height: z.number(), // 높이
  field: z.string(), // 매핑할 데이터 필드명
  fontSize: z.number().default(14), // 폰트 크기
  color: z.string().default("#000000"), // 텍스트 색상
  fontWeight: z.string().default("normal"), // 폰트 굵기
  textAlign: z.enum(["left", "center", "right"]).default("left"), // 정렬
  // 값 표시 범위 설정
  maxLines: z.number().optional(), // 최대 줄 수 (undefined면 제한 없음)
  overflow: z.enum(["visible", "hidden", "ellipsis"]).default("visible"), // 오버플로우 처리
  wordWrap: z.boolean().default(false), // 단어 줄바꿈 여부
  stretchHeight: z.boolean().default(false), // 높이 100% 채우기 (세로 늘림)
});

export const templateStructureSchema = z.object({
  templateImage: z.string(), // 배경 이미지 URL
  imageWidth: z.number(), // 이미지 원본 너비
  imageHeight: z.number(), // 이미지 원본 높이
  fields: z.array(templateFieldSchema), // 필드 배열
});

export type TemplateField = z.infer<typeof templateFieldSchema>;
export type TemplateStructure = z.infer<typeof templateStructureSchema>;

export const insertFormTemplateSchema = createInsertSchema(formTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertFormTemplate = z.infer<typeof insertFormTemplateSchema>;
export type FormTemplate = typeof formTemplates.$inferSelect;

// 입고리스트 테이블 (새 엑셀 구조: Devanning Check List)
export const inboundList = pgTable("inbound_list", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }), // 소유자 (nullable for migration)
  반입번호: text("반입번호"),
  no: text("no"),
  도착Time: text("도착_time"),
  출발Time: text("출발_time"),
  도착예정Time: text("도착예정_time"),
  blNo: text("bl_no"),
  itemNo: text("item_no"),
  dept: text("dept"),
  description: text("description"),
  qty: text("qty"),
  qty_이상유무: text("qty_이상유무"),
  containerCntrNo: text("container_cntr_no"),
  containerSealNo: text("container_seal_no"),
  containerTemp: text("container_temp"),
  container_파손유무: text("container_파손유무"),
  palletQty: text("pallet_qty"),
  mpk: text("mpk"),
  box: text("box"),
  unit: text("unit"),
  palletType: text("pallet_type"),
  제품확인_블록: text("제품확인_블록"),
  제품확인Coo: text("제품확인_coo"),
  제품확인Remark: text("제품확인_remark"),
  수작업_유형: text("수작업_유형"),
  차량번호: text("차량번호"),
  비고: text("비고"),
  구분: text("구분"),
  수입자: text("수입자"),
  costcoBlNo: text("costco_bl_no"),
  tie: text("tie"),
  높이: text("높이"),
  반입일자: date("반입일자"),
  plt: text("plt"),
  매수: text("매수"),
});

export const insertInboundListSchema = createInsertSchema(inboundList).omit({ id: true }).extend({
  반입일자: z.union([z.date(), z.string(), z.null()]).transform(val => {
    if (!val) return null;
    // Date 객체인 경우 YYYY-MM-DD 문자열로 변환
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    // 이미 문자열인 경우 그대로 반환
    return val;
  }).nullable(),
});
export type InsertInboundList = z.infer<typeof insertInboundListSchema>;

// 입고리스트 업데이트 스키마 (모든 필드 편집 가능, null 허용)
export const updateInboundListSchema = z.object({
  반입번호: z.string().nullable().optional(),
  no: z.string().nullable().optional(),
  도착Time: z.string().nullable().optional(),
  출발Time: z.string().nullable().optional(),
  도착예정Time: z.string().nullable().optional(),
  blNo: z.string().nullable().optional(),
  itemNo: z.string().nullable().optional(),
  dept: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  qty: z.string().nullable().optional(),
  qty_이상유무: z.string().nullable().optional(),
  containerCntrNo: z.string().nullable().optional(),
  containerSealNo: z.string().nullable().optional(),
  containerTemp: z.string().nullable().optional(),
  container_파손유무: z.string().nullable().optional(),
  palletQty: z.string().nullable().optional(),
  mpk: z.string().nullable().optional(),
  box: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  palletType: z.string().nullable().optional(),
  제품확인_블록: z.string().nullable().optional(),
  제품확인Coo: z.string().nullable().optional(),
  제품확인Remark: z.string().nullable().optional(),
  수작업_유형: z.string().nullable().optional(),
  차량번호: z.string().nullable().optional(),
  비고: z.string().nullable().optional(),
  구분: z.string().nullable().optional(),
  수입자: z.string().nullable().optional(),
  costcoBlNo: z.string().nullable().optional(),
  tie: z.string().nullable().optional(),
  높이: z.string().nullable().optional(),
  반입일자: z.union([z.date(), z.string(), z.null()]).optional(),
  plt: z.string().nullable().optional(),
  매수: z.string().nullable().optional(),
});
export type UpdateInboundList = z.infer<typeof updateInboundListSchema>;

export type InboundList = typeof inboundList.$inferSelect;

// 유니패스 화물 데이터 테이블 (유니패스 API 원시 응답 저장)
export const unipassCargoData = pgTable("unipass_cargo_data", {
  id: serial("id").primaryKey(),
  inboundListId: integer("inbound_list_id").references(() => inboundList.id, { onDelete: "cascade" }),
  
  // API019 기본 정보 (cargCsclPrgsInfoQryVo)
  cargMtNo: text("carg_mt_no"),           // 화물관리번호
  mblNo: text("mbl_no"),                  // M B/L
  hblNo: text("hbl_no"),                  // H B/L
  csclPrgsStts: text("cscl_prgs_stts"),   // 통관진행상태
  prgsStts: text("prgs_stts"),            // 진행상태
  prnm: text("prnm"),                     // 품명
  pckGcnt: integer("pck_gcnt"),           // 포장개수
  pckUt: text("pck_ut"),                  // 포장단위
  ttwg: decimal("ttwg"),                  // 총중량
  wghtUt: text("wght_ut"),                // 중량단위
  msrm: decimal("msrm"),                  // 용적
  shcoFlco: text("shco_flco"),            // 선사
  cargTp: text("carg_tp"),                // 화물종류
  prcsDttm: text("prcs_dttm"),            // 처리일시
  shipNatNm: text("ship_nat_nm"),         // 선박국적명
  shipNat: text("ship_nat"),              // 선박국적코드
  shipNm: text("ship_nm"),                // 선박명
  blPtNm: text("bl_pt_nm"),               // B/L유형명
  blPt: text("bl_pt"),                    // B/L유형코드
  cntrGcnt: integer("cntr_gcnt"),         // 컨테이너개수
  cntrNo: text("cntr_no"),                // 컨테이너번호
  dsprNm: text("dspr_nm"),                // 하선장소명
  dsprCd: text("dspr_cd"),                // 하선장소코드
  etprDt: text("etpr_dt"),                // 입항일자
  ldprNm: text("ldpr_nm"),                // 적재항명
  ldprCd: text("ldpr_cd"),                // 적재항코드
  lodCntyCd: text("lod_cnty_cd"),         // 적재국가코드
  mtTrgtCargYnNm: text("mt_trgt_carg_yn_nm"), // 관리대상화물여부명
  rlseDtyPridPassTpcd: text("rlse_dty_prid_pass_tpcd"), // 반출의무기간경과유형코드
  spcnCargCd: text("spcn_carg_cd"),       // 특수화물코드
  agnc: text("agnc"),                     // 선사대리점
  etprCstm: text("etpr_cstm"),            // 입항세관
  vydf: text("vydf"),                     // 항차
  dclrDelyAdtxYn: text("dclr_dely_adtx_yn"), // 신고지연가산세여부
  frwrEntsConm: text("frwr_ents_conm"),   // 특송업체명
  
  // 원시 API 응답 저장 (전체 JSON)
  rawPayload: json("raw_payload"),        // 원시 API 응답 전체
  
  // 메타데이터
  apiSource: text("api_source").notNull(), // API019, API020, API021, API024
  queryDate: timestamp("query_date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUnipassCargoDataSchema = createInsertSchema(unipassCargoData).omit({ 
  id: true, 
  createdAt: true,
  updatedAt: true 
});
export type InsertUnipassCargoData = z.infer<typeof insertUnipassCargoDataSchema>;
export type UnipassCargoData = typeof unipassCargoData.$inferSelect;

// 화물표 결과 테이블 (확장 - 유니패스 API + 입고리스트 병합)
export const manifestResults = pgTable("manifest_results", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }), // 소유자 (nullable for migration)
  inboundListId: integer("inbound_list_id").references(() => inboundList.id, { onDelete: "cascade" }),
  
  // 1-11: 기본 정보
  품명: text("품명").notNull(),
  수량: text("수량").notNull(),
  중량: text("중량"),
  입항일자: text("입항일자"),
  contNo: text("cont_no"),
  화물종류: text("화물종류"),
  dryWet: text("dry_wet"),
  수출국명: text("수출국명"),
  선명: text("선명"),
  검역사항: text("검역사항"),
  경유지: text("경유지"),
  
  // 12-14: 중요 정보
  blNo: text("bl_no").notNull(),
  화물관리번호: text("화물관리번호"),
  수입자: text("수입자"),
  
  // 15-26: 상세 정보
  반입일자: date("반입일자"),
  plt: text("plt"),
  bl수량: text("bl수량"),
  tie: text("tie"),
  sellUnitPerCase: text("sell_unit_per_case"),
  do: text("do"),
  itemNo: text("item_no").notNull(),
  수량Pcs: text("수량_pcs"),
  높이: text("높이"),
  소비기한: text("소비기한"),
  특이사항: text("특이사항"),
  costcoBlNo: text("costco_bl_no"),
  매수: text("매수"),
  palletQty: text("pallet_qty"),
  
  // 유니패스 API 추가 필드 (양식 편집기에서 사용 가능)
  mblNo: text("mbl_no"),
  hblNo: text("hbl_no"),
  csclPrgsStts: text("cscl_prgs_stts"),        // 통관진행상태
  prgsStts: text("prgs_stts"),                  // 진행상태
  prcsDttm: text("prcs_dttm"),                  // 처리일시
  prnm: text("prnm"),                           // 품명(원시)
  pckGcnt: text("pck_gcnt"),                    // 포장개수(원시)
  pckUt: text("pck_ut"),                        // 포장단위
  ttwg: text("ttwg"),                           // 총중량
  wghtUt: text("wght_ut"),                      // 중량단위
  msrm: text("msrm"),                           // 용적
  cargTp: text("carg_tp"),                      // 화물종류(원시)
  shipNm: text("ship_nm"),                      // 선박명(원시)
  shipNatNm: text("ship_nat_nm"),               // 선박국적
  shipNat: text("ship_nat"),                    // 선박국적(코드)
  shcoFlco: text("shco_flco"),                  // 선사/항공사
  agnc: text("agnc"),                           // 선사대리점
  vydf: text("vydf"),                           // 항차
  etprDt: text("etpr_dt"),                      // 입항일(원시)
  etprCstm: text("etpr_cstm"),                  // 입항세관
  ldprNm: text("ldpr_nm"),                      // 적재항
  ldprCd: text("ldpr_cd"),                      // 적재항(코드)
  dsprNm: text("dspr_nm"),                      // 하선장소
  dsprCd: text("dspr_cd"),                      // 하선장소(코드)
  lodCntyCd: text("lod_cnty_cd"),               // 적재국가(코드)
  cntrGcnt: text("cntr_gcnt"),                  // 컨테이너개수
  cntrNo: text("cntr_no"),                      // 컨테이너번호
  blPtNm: text("bl_pt_nm"),                     // B/L유형
  blPt: text("bl_pt"),                          // B/L유형(코드)
  spcnCargCd: text("spcn_carg_cd"),             // 특수화물코드
  mtTrgtCargYnNm: text("mt_trgt_carg_yn_nm"),   // 관리대상화물여부
  rlseDtyPridPassTpcd: text("rlse_dty_prid_pass_tpcd"), // 반출의무기간경과유형
  dclrDelyAdtxYn: text("dclr_dely_adtx_yn"),    // 신고지연가산세여부
  frwrEntsConm: text("frwr_ents_conm"),         // 특송업체명
  
  // 메타데이터
  sourceApi: text("source_api"), // API019, API020, API021, API024 등
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertManifestResultSchema = createInsertSchema(manifestResults).omit({ 
  id: true, 
  createdAt: true 
}).extend({
  반입일자: z.union([z.date(), z.string(), z.null()]).transform(val => {
    if (!val) return null;
    // Date 객체인 경우 YYYY-MM-DD 문자열로 변환
    if (val instanceof Date) {
      return val.toISOString().slice(0, 10);
    }
    // 이미 문자열인 경우 그대로 반환
    return val;
  }).nullable(),
});
export type InsertManifestResult = z.infer<typeof insertManifestResultSchema>;
export type ManifestResult = typeof manifestResults.$inferSelect;

// 수입화물검역표 데이터 (입고리스트 + Unipass API 병합)
export type ManifestData = {
  // 1-11: 기본 정보
  품명: string;           // 1 - Description (입고리스트)
  수량: string;           // 2 - Unipass 포장개수(pckGcnt) 우선, 없으면 입고리스트 MPK
  중량: string;           // 3 - Unipass
  입항일자: string;       // 4 - Unipass
  contNo: string;         // 5 - CONTAINER_Cntr No. (입고리스트) 또는 Unipass
  화물종류: string;       // 6 - Unipass
  dryWet: string;         // 7 - 구분 (입고리스트)
  수출국명: string;       // 8 - Unipass
  선명: string;           // 9 - Unipass
  검역사항: string;       // 10 - 고유값 "검역완료 □"
  경유지: string;         // 11 - Unipass
  
  // 12-14: 중요 정보
  blNo: string;           // 12 - B/L No. (입고리스트)
  화물관리번호: string;   // 13 - Unipass
  수입자: string;         // 14 - 수입자 (입고리스트)
  
  // 15-28: 상세 정보
  반입일자: string;       // 15 - 반입일자 (입고리스트)
  palletQty: string;      // 16 - Pallet Q'ty (입고리스트, 기존 필드)
  plt: string;            // 17 - PLT (입고리스트, 새 필드)
  매수: string;           // 18 - 매수 (입고리스트, 새 필드)
  bl수량: string;         // 19 - QTY (입고리스트)
  tie: string;            // 20 - TIE (입고리스트)
  sellUnitPerCase: string; // 21 - UNIT (입고리스트)
  do: string;             // 22 - Dept (입고리스트)
  itemNo: string;         // 23 - Item No. (입고리스트)
  수량Pcs: string;        // 24 - MPK (입고리스트)
  높이: string;           // 25 - 높이 (입고리스트)
  소비기한: string;       // 26 - 도착예정Time (입고리스트)
  특이사항: string;       // 27 - 비고 (입고리스트)
  costcoBlNo: string;     // 28 - Costco B/L No. (입고리스트, 큰 공간 표시용)
};

// Multi-line batch search schema
export const cargoSearchSchema = z.object({
  searchType: z.enum(["mbl", "hbl", "cargo"], {
    required_error: "검색 타입을 선택하세요"
  }),
  queries: z.string().min(1, "검색할 항목을 입력하세요")
}).transform((data, ctx) => {
  // Parse multi-line input
  const lines = data.queries.trim().split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "검색할 항목을 입력하세요",
      path: ["queries"]
    });
    return z.NEVER;
  }
  
  const parsed: Array<{ value: string; year?: string; lineNumber: number }> = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;
    
    if (data.searchType === "mbl" || data.searchType === "hbl") {
      const parts = line.split(";");
      if (parts.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${lineNumber}번째 줄: "번호;연도" 형식으로 입력하세요 (예: MEDUF8843874;2025)`,
          path: ["queries"]
        });
        continue;
      }
      const [value, year] = parts;
      if (!value.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${lineNumber}번째 줄: ${data.searchType === "mbl" ? "M B/L" : "H B/L"} 번호를 입력하세요`,
          path: ["queries"]
        });
        continue;
      }
      if (!year.trim() || year.trim().length !== 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${lineNumber}번째 줄: 연도는 4자리로 입력하세요 (예: 2025)`,
          path: ["queries"]
        });
        continue;
      }
      parsed.push({ value: value.trim(), year: year.trim(), lineNumber });
    } else {
      // cargo number only
      if (!line.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${lineNumber}번째 줄: 화물관리번호를 입력하세요`,
          path: ["queries"]
        });
        continue;
      }
      parsed.push({ value: line.trim(), lineNumber });
    }
  }
  
  return {
    searchType: data.searchType,
    queries: parsed
  };
});

export type CargoSearch = z.infer<typeof cargoSearchSchema>;

export interface BasicCargoInfo {
  cargoId: string;
  mblNo: string;
  hblNo: string;
  status: string;
  itemName: string;
  pkgCount: string;
  volume: string;
  mgmtTarget: string;
  specialCargo: string;
  notification: string;
  returnTransship: string;
  processDate: string;
  carrier: string;
  shipName: string;
  shipNat: string;
  processLocation: string;
  unloadingDate: string;
  unloadingDeadline: string;
  blType: string;
  dutyPeriodPass: string;
  containerNo: string;
  expressCompany: string;
  progressStatus: string;
  cargoType: string;
  shipAgent: string;
  loadingPort: string;
  unloadingPort: string;
  entranceCustoms: string;
  voyageNo: string;
  delayTax: string;
  totalWeight: string;
}

export interface ContainerDetail {
  no: number;
  containerNo: string;
  spec: string;
  seal1: string;
  seal2: string;
  seal3: string;
}

export interface ProgressDetail {
  no: number;
  processType: string;
  location: string;
  locationCode: string;
  pkgCount: string;
  processDate: string;
  releaseDate: string;
  weight: string;
  declarationNo: string;
  releaseInfo: string;
  additionalInfo: string;
}

export interface ArrivalReportInfo {
  submitNumber: string;            // 제출번호
  reportDate: string;              // 보고일자
  approvalDateTime: string;        // 승인일시
  shipName: string;                // 선박명
  shipNationality: string;         // 선박국적
  shipCallSign: string;            // 선박호출/IMO부호
  grossTonnage: string;            // 국제총톤수
  shipType: string;                // 선박종류
  arrivalDateTime: string;         // 입항일시
  arrivalPurpose: string;          // 입항목적
  voyageType: string;              // 항해구분
  carrierAgentName: string;        // 선사/대리점명
  ciqLocation: string;             // CIQ수속장소
  ciqDateTime: string;             // CIQ수속일시
  berthingLocation: string;        // 선박계선장소
}

export interface VoyageHistory {
  firstDeparturePort: string;      // 최초출항지
  previousDeparturePort: string;   // 전출항지
  previousDepartureDateTime: string; // 전출항지출항일시
  stopover1: string;               // 경유지1
  stopover2: string;               // 경유지2
  stopover3: string;               // 경유지3
  stopover4: string;               // 경유지4
  stopover5: string;               // 경유지5
  yearlyArrivalCount: string;      // 당해년도입항횟수
}

export interface BerthingMovement {
  no: number;                      // 제출차수
  declarer: string;                // 신고인
  declarationDate: string;         // 신고일자
  previousBerthing: string;        // 변경전정박장소
  movementReason: string;          // 이동사유
  plannedMovementDate: string;     // 이동 예정일
  newBerthing: string;             // 변경후정박장소
}

export interface CargoTrackingResult {
  basicInfo: BasicCargoInfo;
  containers: ContainerDetail[];
  progressDetails: ProgressDetail[];
  arrivalReport: ArrivalReportInfo;
  voyageHistory: VoyageHistory;
  berthingMovements: BerthingMovement[];
}

// Batch search result
export interface BatchCargoResult {
  input: string;
  lineNumber: number;
  result?: CargoTrackingResult;
  manifest?: ManifestData;
  error?: string;
}

export interface UnipassProgressDetail {
  shedNm?: string;
  prcsDttm?: number | string;
  dclrNo?: string;
  rlbrDttm?: string;
  wght?: number | string;
  rlbrBssNo?: string;
  bfhnGdncCn?: string;
  wghtUt?: string;
  pckGcnt?: number;
  cargTrcnRelaBsopTpcd?: string;
  pckUt?: string;
  rlbrCn?: string;
  shedSgn?: number | string;
}

export interface UnipassApiResponse {
  cargCsclPrgsInfoQryVo?: {
    cargMtNo?: string;
    mblNo?: string;
    hblNo?: string;
    csclPrgsStts?: string;
    prgsStts?: string;
    prnm?: string;
    pckGcnt?: number;
    pckUt?: string;
    ttwg?: number;
    wghtUt?: string;
    msrm?: number;
    shcoFlco?: string;
    cargTp?: string;
    prcsDttm?: number;
    shipNatNm?: string;
    shipNat?: string;
    shipNm?: string;
    blPtNm?: string;
    blPt?: string;
    cntrGcnt?: number;
    cntrNo?: string;
    dsprNm?: string;
    dsprCd?: string;
    etprDt?: number;
    ldprNm?: string;
    ldprCd?: string;
    lodCntyCd?: string;
    mtTrgtCargYnNm?: string;
    rlseDtyPridPassTpcd?: string;
    spcnCargCd?: string;
    agnc?: string;
    etprCstm?: string;
    vydf?: string;
    dclrDelyAdtxYn?: string;
    frwrEntsConm?: string;
  };
  cargCsclPrgsInfoDtlQryVo?: UnipassProgressDetail | UnipassProgressDetail[];
}

// 필드 메타데이터 타입
export interface FieldMetadata {
  manifestField: keyof ManifestData;      // 화물표 필드명 (예: "품명", "수량")
  sourceCategory: "유니패스 API" | "입고리스트" | "화물표 결과";
  sourceTable: "unipass" | "inbound" | "manifest";
  sourceField: string;                     // 실제 데이터베이스 필드명
  displayName: string;                     // 드롭다운에 표시될 이름
  description?: string;                    // 필드 설명
}

// 전체 필드 메타데이터 매핑 (모든 가능한 소스 옵션 포함)
export const FIELD_METADATA: FieldMetadata[] = [
  // 1. 품명
  { manifestField: "품명", sourceCategory: "유니패스 API", sourceTable: "unipass", sourceField: "prnm", displayName: "prnm (품명)", description: "유니패스 API 품명" },
  { manifestField: "품명", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "description", displayName: "description (Description)", description: "입고리스트 품명" },
  { manifestField: "품명", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "품명", displayName: "품명 (병합 결과)", description: "화물표 품명" },

  // 2. 수량
  { manifestField: "수량", sourceCategory: "유니패스 API", sourceTable: "unipass", sourceField: "pckGcnt", displayName: "pckGcnt (포장개수)", description: "유니패스 API 포장개수" },
  { manifestField: "수량", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "mpk", displayName: "mpk (MPK)", description: "입고리스트 MPK" },
  { manifestField: "수량", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "qty", displayName: "qty (QTY)", description: "입고리스트 수량" },
  { manifestField: "수량", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "수량", displayName: "수량 (병합 결과)", description: "화물표 수량 (유니패스 우선)" },

  // 3. 중량
  { manifestField: "중량", sourceCategory: "유니패스 API", sourceTable: "unipass", sourceField: "ttwg", displayName: "ttwg (총중량)", description: "유니패스 API 총중량" },
  { manifestField: "중량", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "중량", displayName: "중량 (병합 결과)", description: "화물표 중량" },

  // 4. 입항일자
  { manifestField: "입항일자", sourceCategory: "유니패스 API", sourceTable: "unipass", sourceField: "etprDt", displayName: "etprDt (입항일자)", description: "유니패스 API 입항일자" },
  { manifestField: "입항일자", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "입항일자", displayName: "입항일자 (병합 결과)", description: "화물표 입항일자" },

  // 5. contNo
  { manifestField: "contNo", sourceCategory: "유니패스 API", sourceTable: "unipass", sourceField: "cntrNo", displayName: "cntrNo (컨테이너번호)", description: "유니패스 API 컨테이너번호" },
  { manifestField: "contNo", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "containerCntrNo", displayName: "containerCntrNo (Cntr No.)", description: "입고리스트 컨테이너 번호" },
  { manifestField: "contNo", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "contNo", displayName: "contNo (병합 결과)", description: "화물표 컨테이너 번호" },

  // 6. 화물종류
  { manifestField: "화물종류", sourceCategory: "유니패스 API", sourceTable: "unipass", sourceField: "cargTp", displayName: "cargTp (화물종류)", description: "유니패스 API 화물종류" },
  { manifestField: "화물종류", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "화물종류", displayName: "화물종류 (병합 결과)", description: "화물표 화물종류" },

  // 7. dryWet
  { manifestField: "dryWet", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "구분", displayName: "구분 (DRY/WET)", description: "입고리스트 구분" },
  { manifestField: "dryWet", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "dryWet", displayName: "dryWet (병합 결과)", description: "화물표 DRY/WET 구분" },

  // 8. 수출국명
  { manifestField: "수출국명", sourceCategory: "유니패스 API", sourceTable: "unipass", sourceField: "lodCntyCd", displayName: "lodCntyCd (적재국가코드)", description: "유니패스 API 적재국가코드" },
  { manifestField: "수출국명", sourceCategory: "유니패스 API", sourceTable: "unipass", sourceField: "ldprNm", displayName: "ldprNm (적재항명)", description: "유니패스 API 적재항명" },
  { manifestField: "수출국명", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "수출국명", displayName: "수출국명 (병합 결과)", description: "화물표 수출국명" },

  // 9. 선명
  { manifestField: "선명", sourceCategory: "유니패스 API", sourceTable: "unipass", sourceField: "shipNm", displayName: "shipNm (선박명)", description: "유니패스 API 선박명" },
  { manifestField: "선명", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "선명", displayName: "선명 (병합 결과)", description: "화물표 선명" },

  // 10. 검역사항
  { manifestField: "검역사항", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "검역사항", displayName: "검역사항 (병합 결과)", description: "화물표 검역사항 (고정값: 검역완료 □)" },

  // 11. 경유지
  { manifestField: "경유지", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "경유지", displayName: "경유지 (병합 결과)", description: "화물표 경유지" },

  // 12. blNo
  { manifestField: "blNo", sourceCategory: "유니패스 API", sourceTable: "unipass", sourceField: "mblNo", displayName: "mblNo (Master B/L)", description: "유니패스 API Master B/L" },
  { manifestField: "blNo", sourceCategory: "유니패스 API", sourceTable: "unipass", sourceField: "hblNo", displayName: "hblNo (House B/L)", description: "유니패스 API House B/L" },
  { manifestField: "blNo", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "blNo", displayName: "blNo (B/L No.)", description: "입고리스트 B/L 번호" },
  { manifestField: "blNo", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "blNo", displayName: "blNo (병합 결과)", description: "화물표 B/L 번호" },

  // 13. 화물관리번호
  { manifestField: "화물관리번호", sourceCategory: "유니패스 API", sourceTable: "unipass", sourceField: "cargMtNo", displayName: "cargMtNo (화물관리번호)", description: "유니패스 API 화물관리번호" },
  { manifestField: "화물관리번호", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "화물관리번호", displayName: "화물관리번호 (병합 결과)", description: "화물표 화물관리번호" },

  // 14. 수입자
  { manifestField: "수입자", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "수입자", displayName: "수입자", description: "입고리스트 수입자" },
  { manifestField: "수입자", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "수입자", displayName: "수입자 (병합 결과)", description: "화물표 수입자" },

  // 15. 반입일자
  { manifestField: "반입일자", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "반입일자", displayName: "반입일자", description: "입고리스트 반입일자" },
  { manifestField: "반입일자", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "반입일자", displayName: "반입일자 (병합 결과)", description: "화물표 반입일자" },

  // 16. plt
  { manifestField: "plt", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "palletQty", displayName: "palletQty (Pallet Q'ty)", description: "입고리스트 팔레트 수량" },
  { manifestField: "plt", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "plt", displayName: "plt (병합 결과)", description: "화물표 팔레트 수량" },

  // 17. bl수량
  { manifestField: "bl수량", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "qty", displayName: "qty (QTY)", description: "입고리스트 B/L 수량" },
  { manifestField: "bl수량", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "bl수량", displayName: "bl수량 (병합 결과)", description: "화물표 B/L 수량" },

  // 18. tie
  { manifestField: "tie", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "tie", displayName: "tie (TIE)", description: "입고리스트 TIE" },
  { manifestField: "tie", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "tie", displayName: "tie (병합 결과)", description: "화물표 TIE" },

  // 19. sellUnitPerCase
  { manifestField: "sellUnitPerCase", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "unit", displayName: "unit (UNIT)", description: "입고리스트 단위" },
  { manifestField: "sellUnitPerCase", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "sellUnitPerCase", displayName: "sellUnitPerCase (병합 결과)", description: "화물표 판매 단위" },

  // 20. do
  { manifestField: "do", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "dept", displayName: "dept (Dept)", description: "입고리스트 부서" },
  { manifestField: "do", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "do", displayName: "do (병합 결과)", description: "화물표 DO" },

  // 21. itemNo
  { manifestField: "itemNo", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "itemNo", displayName: "itemNo (Item No.)", description: "입고리스트 아이템 번호" },
  { manifestField: "itemNo", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "itemNo", displayName: "itemNo (병합 결과)", description: "화물표 아이템 번호" },

  // 22. 수량Pcs
  { manifestField: "수량Pcs", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "mpk", displayName: "mpk (MPK)", description: "입고리스트 MPK" },
  { manifestField: "수량Pcs", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "box", displayName: "box (BOX)", description: "입고리스트 BOX" },
  { manifestField: "수량Pcs", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "수량Pcs", displayName: "수량Pcs (병합 결과)", description: "화물표 수량(PCS)" },

  // 23. 높이
  { manifestField: "높이", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "높이", displayName: "높이", description: "입고리스트 높이" },
  { manifestField: "높이", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "높이", displayName: "높이 (병합 결과)", description: "화물표 높이" },

  // 24. 소비기한
  { manifestField: "소비기한", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "도착예정Time", displayName: "도착예정Time (소비기한)", description: "입고리스트 도착예정시간" },
  { manifestField: "소비기한", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "소비기한", displayName: "소비기한 (병합 결과)", description: "화물표 소비기한" },

  // 25. 특이사항
  { manifestField: "특이사항", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "비고", displayName: "비고 (특이사항)", description: "입고리스트 비고" },
  { manifestField: "특이사항", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "특이사항", displayName: "특이사항 (병합 결과)", description: "화물표 특이사항" },

  // 26. costcoBlNo
  { manifestField: "costcoBlNo", sourceCategory: "입고리스트", sourceTable: "inbound", sourceField: "costcoBlNo", displayName: "costcoBlNo (Costco B/L No.)", description: "입고리스트 코스트코 B/L 번호" },
  { manifestField: "costcoBlNo", sourceCategory: "화물표 결과", sourceTable: "manifest", sourceField: "costcoBlNo", displayName: "costcoBlNo (병합 결과)", description: "화물표 코스트코 B/L 번호" },
];

// 카테고리별로 그룹화된 필드 목록 반환
export function getFieldsByCategory() {
  const categories: Record<string, FieldMetadata[]> = {
    "유니패스 API": [],
    "입고리스트": [],
    "화물표 결과": [],
  };

  FIELD_METADATA.forEach(field => {
    categories[field.sourceCategory].push(field);
  });

  return categories;
}

// 특정 화물표 필드의 메타데이터 조회
export function getFieldMetadata(manifestField: keyof ManifestData): FieldMetadata[] {
  return FIELD_METADATA.filter(f => f.manifestField === manifestField);
}

// 일괄 인쇄 PDF 생성 작업
export const batchPrintJobSchema = z.object({
  id: z.string(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  manifestData: z.array(z.any()), // Array<{ data: ManifestData; template: FormTemplate }>
  pdfPath: z.string().optional(),
  totalPages: z.number(),
  processedPages: z.number().default(0),
  error: z.string().optional(),
  createdAt: z.date(),
  completedAt: z.date().optional(),
});

export type BatchPrintJob = z.infer<typeof batchPrintJobSchema>;

// API 요청/응답 타입
export const createBatchPrintJobRequestSchema = z.object({
  manifestData: z.array(z.any()),
});

export type CreateBatchPrintJobRequest = z.infer<typeof createBatchPrintJobRequestSchema>;
