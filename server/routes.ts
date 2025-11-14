import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import axios from "axios";
import { XMLParser } from "fast-xml-parser";
import { type UnipassApiResponse, type CargoTrackingResult, type ArrivalReportInfo, inboundList, type InsertInboundList, formTemplates, insertFormTemplateSchema, manifestResults, insertManifestResultSchema, type InsertManifestResult, unipassCargoData, insertUnipassCargoDataSchema, type InsertUnipassCargoData, createBatchPrintJobRequestSchema, users, insertUserSchema } from "@shared/schema";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import multer from "multer";
import bcrypt from "bcrypt";
import { db } from "./db";
import { eq, desc, and, or, isNull } from "drizzle-orm";
import * as pdfService from "./pdf-service";

const UNIPASS_API_URL = "https://unipass.customs.go.kr:38010/ext/rest/cargCsclPrgsInfoQry/retrieveCargCsclPrgsInfo";
const CONTAINER_API_URL = "https://unipass.customs.go.kr:38010/ext/rest/cntrQryBrkdQry/retrieveCntrQryBrkd";
const ARRIVAL_API_URL = "https://unipass.customs.go.kr:38010/ext/rest/etprRprtQryBrkdQry/retrieveetprRprtQryBrkd";
const IOPR_API_URL = "https://unipass.customs.go.kr:38010/ext/rest/ioprRprtQry/retrieveIoprRprtBrkd";

// 화물통관진행 정보조회 (API019)
const API_KEY = process.env.UNIPASS_API_KEY || "i250u215r005d247t020j020x6";
// 컨테이너조회 (API020)
const CONTAINER_API_KEY = process.env.UNIPASS_CONTAINER_API_KEY || "m280i295o150r237r060o000a5";
// 입항보고내역조회(해상) (API021) - 원래 키로 복구
const ARRIVAL_API_KEY = process.env.UNIPASS_ARRIVAL_API_KEY || "l280q235k005q237s080e030e6";
// 입출항보고내역 (API024)
const ARRIVAL_REPORT_API_KEY = process.env.UNIPASS_ARRIVAL_REPORT_API_KEY || "q280l205c005e277i030n060o8";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "text",
  parseAttributeValue: true,
  trimValues: true
});

function normalizeToArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function formatDate(dateNum?: number | string): string {
  if (!dateNum) return "";
  const dateStr = String(dateNum);
  if (dateStr.length === 8) {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  } else if (dateStr.length === 14) {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)} ${dateStr.substring(8, 10)}:${dateStr.substring(10, 12)}:${dateStr.substring(12, 14)}`;
  }
  return dateStr;
}

function formatDateTime(dateNum?: number | string): string {
  if (!dateNum) return "";
  const dateStr = String(dateNum);
  if (dateStr.length === 8) {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  } else if (dateStr.length === 14) {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)} ${dateStr.substring(8, 10)}:${dateStr.substring(10, 12)}:${dateStr.substring(12, 14)}`;
  }
  return dateStr;
}

// Excel 날짜 숫자를 Date 객체로 변환 (내부 처리용)
function excelDateToDate(excelDate?: string | number | Date | null): Date | null {
  if (!excelDate) return null;
  
  // Date 객체인 경우 그대로 반환
  if (excelDate instanceof Date) {
    return isNaN(excelDate.getTime()) ? null : excelDate;
  }
  
  // 문자열인 경우: Date.parse로 유효한 날짜 문자열인지 확인
  if (typeof excelDate === 'string') {
    const parsedTime = Date.parse(excelDate);
    if (!isNaN(parsedTime)) {
      // 유효한 날짜 문자열 (ISO, timestamp 등)
      return new Date(parsedTime);
    }
  }
  
  // 숫자 또는 숫자 문자열인 경우: Excel serial number로 처리
  const num = typeof excelDate === 'string' ? parseFloat(excelDate) : excelDate;
  if (isNaN(num)) return null;
  
  // Excel epoch: 1899-12-30 (Excel은 1900-01-01을 1로 계산)
  const excelEpoch = new Date(1899, 11, 30);
  return new Date(excelEpoch.getTime() + (num * 24 * 60 * 60 * 1000));
}

// Excel 날짜 숫자를 YYYY-MM-DD ISO 형식으로 변환 (DB 저장용)
function excelDateToISODate(excelDate?: string | number | Date | null): string | null {
  const dateObj = excelDateToDate(excelDate);
  if (!dateObj) return null;
  
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Excel 날짜 숫자를 YYYY-MM-DD 형식으로 변환 (표시용)
function excelDateToString(excelDate?: string | number | null | Date): string {
  if (!excelDate) return "-";
  
  // Date 객체인 경우
  if (excelDate instanceof Date) {
    if (isNaN(excelDate.getTime())) return "-";
    const year = excelDate.getFullYear();
    const month = String(excelDate.getMonth() + 1).padStart(2, '0');
    const day = String(excelDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // 문자열인 경우: Date.parse로 유효한 날짜 문자열인지 확인
  if (typeof excelDate === 'string') {
    const parsedTime = Date.parse(excelDate);
    if (!isNaN(parsedTime)) {
      // 유효한 날짜 문자열 (ISO, timestamp 등)
      const jsDate = new Date(parsedTime);
      const year = jsDate.getFullYear();
      const month = String(jsDate.getMonth() + 1).padStart(2, '0');
      const day = String(jsDate.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  
  // 숫자 또는 숫자 문자열인 경우: Excel serial number로 처리
  const num = typeof excelDate === 'string' ? parseFloat(excelDate) : excelDate;
  if (isNaN(num)) return String(excelDate);
  
  // Excel epoch: 1899-12-30 (Excel은 1900-01-01을 1로 계산)
  const excelEpoch = new Date(1899, 11, 30);
  const jsDate = new Date(excelEpoch.getTime() + (num * 24 * 60 * 60 * 1000));
  
  const year = jsDate.getFullYear();
  const month = String(jsDate.getMonth() + 1).padStart(2, '0');
  const day = String(jsDate.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}


// B/L 형식 자동 인식 함수 (M B/L vs H B/L)
function detectBLType(blNo: string): 'mbl' | 'hbl' {
  const trimmed = blNo.trim().toUpperCase();
  
  // H B/L 패턴 1: 순수 숫자로만 구성 (예: 1067829293)
  if (/^\d+$/.test(trimmed)) {
    return 'hbl';
  }
  
  // H B/L 패턴 2: 짧은 문자 + 긴 숫자 (예: CNDLC0000059530)
  // - 전체 13자 이상
  // - 뒷부분 숫자가 8자리 이상
  const match = trimmed.match(/^([A-Z]{3,6})(\d{8,})$/);
  if (match && trimmed.length >= 13) {
    return 'hbl';
  }
  
  // M B/L 패턴: 문자로 시작하는 그 외 모든 경우
  // (예: MEDUF8843874, ONEYRICEKP188800)
  if (/^[A-Z]/.test(trimmed)) {
    return 'mbl';
  }
  
  // 기본값: M B/L로 간주
  return 'mbl';
}

// 적재항에서 국가 코드 추출
function extractCountryFromPort(loadingPort: string): string {
  if (!loadingPort) return "";
  // 형식: USLAX:Los Angeles, US, US
  // 마지막 쉼표 뒤의 국가 코드 추출
  const parts = loadingPort.split(',').map(p => p.trim());
  if (parts.length > 0) {
    return parts[parts.length - 1];
  }
  return "";
}

// 국가 코드를 한국어 국가명으로 변환
function getCountryName(countryCode: string): string {
  const countryMap: Record<string, string> = {
    'US': '미국',
    'CN': '중국',
    'JP': '일본',
    'KR': '한국',
    'VN': '베트남',
    'TH': '태국',
    'ID': '인도네시아',
    'MY': '말레이시아',
    'SG': '싱가포르',
    'PH': '필리핀',
    'IN': '인도',
    'DE': '독일',
    'GB': '영국',
    'FR': '프랑스',
    'IT': '이탈리아',
    'ES': '스페인',
    'NL': '네덜란드',
    'BE': '벨기에',
    'CA': '캐나다',
    'AU': '호주',
    'NZ': '뉴질랜드',
    'MX': '멕시코',
    'BR': '브라질',
    'AR': '아르헨티나',
    'CL': '칠레',
    'PE': '페루',
    'TW': '대만',
    'HK': '홍콩',
    'AE': '아랍에미리트',
    'SA': '사우디아라비아',
    'TR': '터키',
    'RU': '러시아',
    'ZA': '남아프리카공화국',
  };
  return countryMap[countryCode] || countryCode;
}

// 수출국명 생성 (국가코드/한국어국가명)
function formatExportCountry(loadingPort: string): string {
  const countryCode = extractCountryFromPort(loadingPort);
  if (!countryCode) return "-";
  const countryName = getCountryName(countryCode);
  return `${countryCode}/${countryName}`;
}

// 입고리스트 데이터에서 화물표 필드 추출 (공통 매핑 로직)
function extractInboundFields(item: any) {
  // 반입일자를 ISO 형식 문자열 또는 null로 변환 (DATE 타입 컬럼에 저장)
  let 반입일자Value: string | null = null;
  if (item.반입일자) {
    if (item.반입일자 instanceof Date) {
      반입일자Value = item.반입일자.toISOString().slice(0, 10);
    } else if (typeof item.반입일자 === 'string') {
      // YYYY-MM-DD 형식이거나 다른 유효한 날짜 문자열
      const parsed = Date.parse(item.반입일자);
      if (!isNaN(parsed)) {
        반입일자Value = new Date(parsed).toISOString().slice(0, 10);
      }
    }
  }
  
  return {
    품명: item.description || "-",
    dryWet: item.구분 || "-",
    수입자: item.수입자 || "-",
    반입일자: 반입일자Value,
    plt: item.plt || "-",
    매수: item.매수 || "-",
    bl수량: item.qty || "-",
    tie: item.tie || "-",
    sellUnitPerCase: item.unit || "-",
    do: item.dept ? `D${item.dept}` : "-",
    itemNo: item.itemNo ? `#${item.itemNo}` : "-",
    수량Pcs: item.mpk || "-",
    높이: item.높이 || "-",
    소비기한: item.도착예정Time || "-",
    특이사항: item.비고 || "-",
    costcoBlNo: item.costcoBlNo || "-",
    contNo: item.containerCntrNo || "-",
  };
}

function parseArrivalReport(ioprData: any, ioprSbmtNo: string | null, progressDetails: any[]): ArrivalReportInfo {
  // API024 데이터가 없으면 모든 필드를 빈값으로 반환
  if (!ioprData || !ioprData.etprRprtQryBrkdQryVo || !ioprSbmtNo) {
    return {
      submitNumber: "",
      reportDate: "",
      approvalDateTime: "",
      shipName: "",
      shipNationality: "",
      shipCallSign: "",
      grossTonnage: "",
      shipType: "",
      arrivalDateTime: "",
      arrivalPurpose: "",
      voyageType: "",
      carrierAgentName: "",
      ciqLocation: "",
      ciqDateTime: "",
      berthingLocation: ""
    };
  }
  
  // ioprSbmtNo가 일치하는 항목 찾기
  const items = normalizeToArray(ioprData.etprRprtQryBrkdQryVo);
  const arrival = items.find((item: any) => item.ioprSbmtNo === ioprSbmtNo);
  
  if (!arrival) {
    return {
      submitNumber: "",
      reportDate: "",
      approvalDateTime: "",
      shipName: "",
      shipNationality: "",
      shipCallSign: "",
      grossTonnage: "",
      shipType: "",
      arrivalDateTime: "",
      arrivalPurpose: "",
      voyageType: "",
      carrierAgentName: "",
      ciqLocation: "",
      ciqDateTime: "",
      berthingLocation: ""
    };
  }
  
  // 승인일시는 API019의 "입항보고 수리" 진행 내역에서 추출
  const entryReportItem = progressDetails.find((d: any) => 
    d.cargTrcnRelaBsopTpcd && d.cargTrcnRelaBsopTpcd.includes("입항보고 수리")
  );
  const approvalDateTime = entryReportItem?.prcsDttm ? formatDateTime(entryReportItem.prcsDttm) : "";
  
  return {
    submitNumber: arrival.ioprSbmtNo || "",
    reportDate: arrival.etprDttm ? formatDate(arrival.etprDttm) : "",
    approvalDateTime: approvalDateTime,
    shipName: arrival.shipFlgtNm || "",
    shipNationality: arrival.shipAirCntyNm || "",
    shipCallSign: "",  // API024에는 없음
    grossTonnage: "",  // API024에는 없음
    shipType: "",      // API024에는 없음
    arrivalDateTime: arrival.etprDttm ? formatDateTime(arrival.etprDttm) : "",
    arrivalPurpose: "", // API024에는 없음
    voyageType: "",    // API024에는 없음
    carrierAgentName: arrival.cstmNm || "",
    ciqLocation: "",   // API024에는 없음
    ciqDateTime: "",   // API024에는 없음
    berthingLocation: arrival.shipLamrPlcNm || ""
  };
}

function parseUnipassResponse(apiData: UnipassApiResponse, containerData: any, ioprData: any, ioprSbmtNo: string | null): CargoTrackingResult {
  const basic = apiData.cargCsclPrgsInfoQryVo || {};
  const progressDetails = normalizeToArray(apiData.cargCsclPrgsInfoDtlQryVo);

  if (Object.keys(basic).length === 0) {
    throw new Error("조회된 데이터가 없습니다. B/L 번호나 연도를 확인하세요.");
  }

  // 컨테이너 정보 처리
  let containerInfo: any[] = [];
  if (containerData && containerData.cntrQryBrkdQryVo) {
    const containers = normalizeToArray(containerData.cntrQryBrkdQryVo);
    containerInfo = containers.map((c: any, idx: number) => ({
      no: idx + 1,
      containerNo: c.cntrNo || "",
      spec: c.cntrStszCd || "",
      seal1: c.cntrSelgNo1 || "",
      seal2: c.cntrSelgNo2 || "",
      seal3: c.cntrSelgNo3 || ""
    }));
  } else if (basic.cntrNo) {
    // 기본 API에서 컨테이너 번호만 있는 경우
    containerInfo = [{
      no: 1,
      containerNo: basic.cntrNo,
      spec: "",
      seal1: "",
      seal2: "",
      seal3: ""
    }];
  }

  // 항해기록 정보 (API021이 없으면 모두 빈값)
  const voyageHistory: any = {
    firstDeparturePort: "",
    previousDeparturePort: "",
    previousDepartureDateTime: "",
    stopover1: "",
    stopover2: "",
    stopover3: "",
    stopover4: "",
    stopover5: "",
    yearlyArrivalCount: ""
  };

  // 항내 정박장소 이동신고 (API021이 없으면 빈 배열)
  const berthingMovements: any[] = [];

  return {
    basicInfo: {
      cargoId: basic.cargMtNo || "",
      mblNo: basic.mblNo || "",
      hblNo: basic.hblNo || "",
      status: basic.csclPrgsStts || "",
      itemName: basic.prnm || "",
      pkgCount: `${basic.pckGcnt || ""} ${basic.pckUt || ""}`.trim(),
      volume: basic.msrm ? String(basic.msrm) : "",
      mgmtTarget: basic.mtTrgtCargYnNm || "",
      specialCargo: basic.spcnCargCd || "",
      notification: "",
      returnTransship: "",
      processDate: formatDate(basic.prcsDttm),
      carrier: basic.shcoFlco || "",
      shipName: basic.shipNm || "",
      shipNat: basic.shipNatNm || "",
      processLocation: basic.dsprCd && basic.dsprNm ? `${basic.dsprCd}${basic.dsprNm}` : "",
      unloadingDate: formatDate(basic.etprDt),
      unloadingDeadline: "",
      blType: basic.blPtNm || "",
      dutyPeriodPass: basic.rlseDtyPridPassTpcd || "",
      containerNo: basic.cntrNo || "",
      expressCompany: basic.frwrEntsConm || "",
      progressStatus: basic.prgsStts || "",
      cargoType: basic.cargTp || "",
      shipAgent: basic.agnc || "",
      loadingPort: basic.ldprCd && basic.ldprNm ? `${basic.ldprCd}:${basic.ldprNm}${basic.lodCntyCd ? ', ' + basic.lodCntyCd : ''}` : "",
      unloadingPort: basic.dsprCd && basic.dsprNm ? `${basic.dsprCd}:${basic.dsprNm}` : "",
      entranceCustoms: basic.etprCstm || "",
      voyageNo: basic.vydf || "",
      delayTax: basic.dclrDelyAdtxYn || "",
      totalWeight: basic.ttwg && basic.wghtUt ? `${basic.ttwg.toLocaleString()} ${basic.wghtUt}` : ""
    },
    containers: containerInfo,
    progressDetails: progressDetails.map((d, idx) => ({
      no: progressDetails.length - idx,
      processType: d.cargTrcnRelaBsopTpcd || "",
      location: d.shedNm || "",
      locationCode: d.shedSgn ? String(d.shedSgn) : "",
      pkgCount: d.pckGcnt && d.pckUt ? `${d.pckGcnt} ${d.pckUt}` : "",
      processDate: formatDate(d.prcsDttm),
      releaseDate: d.rlbrDttm || "",
      weight: d.wght && d.wghtUt ? `${d.wght} ${d.wghtUt}` : "",
      declarationNo: d.dclrNo ? String(d.dclrNo) : "",
      releaseInfo: d.rlbrCn || d.rlbrBssNo || "",
      additionalInfo: d.bfhnGdncCn || ""
    })),
    arrivalReport: parseArrivalReport(ioprData, ioprSbmtNo, progressDetails),
    voyageHistory,
    berthingMovements
  };
}

// Helper function to fetch single cargo data
async function fetchSingleCargo(
  searchType: string,
  value: string,
  year?: string
): Promise<{ result: CargoTrackingResult; rawApiData: UnipassApiResponse }> {
  // 1단계: 기본 화물 정보 조회 - 검색 타입에 따라 다른 파라미터 전달
  let apiParams: any = { crkyCn: API_KEY };
  let inputCargMtNo: string | undefined;
  
  if (searchType === 'mbl') {
    apiParams.mblNo = value;
    apiParams.hblNo = '';
    apiParams.blYy = year;
  } else if (searchType === 'hbl') {
    apiParams.mblNo = '';
    apiParams.hblNo = value;
    apiParams.blYy = year;
  } else if (searchType === 'cargo') {
    // 화물관리번호를 API가 기대하는 형식으로 정규화 (대문자, 하이픈 제거)
    const normalizedCargMtNo = value.toUpperCase().replace(/-/g, '');
    apiParams.cargMtNo = normalizedCargMtNo;
    inputCargMtNo = normalizedCargMtNo;
  }
  
  const cargoResponse = await axios.get(UNIPASS_API_URL, { 
    params: apiParams,
    timeout: 30000,
    responseType: 'text'
  });

  if (!cargoResponse.data || cargoResponse.data.length === 0) {
    throw new Error("관세청 API에서 응답이 없습니다. B/L 번호나 연도를 확인하거나, API 인증키가 유효한지 확인해주세요.");
  }
  
  const parsedCargo = xmlParser.parse(cargoResponse.data);
  const cargoData: UnipassApiResponse = parsedCargo?.cargCsclPrgsInfoQryRtnVo || {};
  
  // 화물관리번호 추출
  const basicInfoArray = normalizeToArray(cargoData?.cargCsclPrgsInfoQryVo);
  const basicInfo = basicInfoArray[0] || cargoData?.cargCsclPrgsInfoQryVo || {};
  const cargMtNo = basicInfo?.cargMtNo || inputCargMtNo;
  
  // 진행내역에서 입출항제출번호 추출 (입항보고 수리 단계의 dclrNo)
  const progressDetails = normalizeToArray(cargoData?.cargCsclPrgsInfoDtlQryVo);
  const entryReportItem = progressDetails.find((d: any) => 
    d.cargTrcnRelaBsopTpcd && d.cargTrcnRelaBsopTpcd.includes("입항보고 수리")
  );
  const ioprSbmtNo = entryReportItem?.dclrNo ? String(entryReportItem.dclrNo) : null;
  
  console.log("=== API019 추출 정보 ===");
  console.log("화물관리번호:", cargMtNo);
  console.log("입출항제출번호:", ioprSbmtNo);
  
  // 2단계: API021로 shipCallImoNo, cstmSgn 추출
  let shipCallImoNo = null;
  let cstmSgn = null;
  
  if (ioprSbmtNo) {
    try {
      const api021Response = await axios.get(ARRIVAL_API_URL, {
        params: { crkyCn: ARRIVAL_API_KEY, ioprSbmtNo },
        timeout: 30000,
        responseType: 'text'
      });
      
      const parsed021 = xmlParser.parse(api021Response.data);
      const arrival021 = parsed021?.etprRprtQryBrkdQryRtnVo?.etprRprtQryBrkdQryVo;
      
      if (arrival021) {
        shipCallImoNo = arrival021.shipCallImoNo;
        cstmSgn = arrival021.cstmSgn;
        console.log("=== API021 성공 ===");
        console.log("shipCallImoNo:", shipCallImoNo);
        console.log("cstmSgn:", cstmSgn);
      }
    } catch (e) {
      console.log("=== API021 호출 실패 ===", String(e).substring(0, 200));
    }
  }
  
  // 3단계: 병렬 조회
  const [containerResponse, ioprResponse] = await Promise.all([
    // 컨테이너 내역
    cargMtNo ? axios.get(CONTAINER_API_URL, {
      params: { crkyCn: CONTAINER_API_KEY, cargMtNo: cargMtNo },
      timeout: 30000,
      responseType: 'text'
    }).catch(() => {
      return { data: null };
    }) : Promise.resolve({ data: null }),
    // API024 - 입출항보고내역
    shipCallImoNo && cstmSgn ? axios.get(IOPR_API_URL, {
      params: {
        crkyCn: ARRIVAL_REPORT_API_KEY,
        seaFlghIoprTpcd: '10', // 해상 수입 고정
        shipCallImoNo: shipCallImoNo,
        cstmSgn: cstmSgn
      },
      timeout: 30000,
      responseType: 'text'
    }).catch((err) => {
      console.log("=== API024 에러 ===");
      console.log("파라미터:", { seaFlghIoprTpcd: '10', shipCallImoNo, cstmSgn });
      console.log("에러:", err.message);
      return { data: null };
    }) : Promise.resolve({ data: null })
  ]);
  
  // 컨테이너 데이터 파싱
  let containerData: any = null;
  if (containerResponse.data) {
    try {
      const parsedContainer = xmlParser.parse(containerResponse.data);
      containerData = parsedContainer?.cntrQryBrkdQryRtnVo || null;
      
      if (containerData && containerData.cntrQryBrkdQryVo) {
        console.log("=== API020 컨테이너 응답 성공 ===");
      }
    } catch (e) {
      // 파싱 오류 무시
    }
  }
  
  // API024 입출항보고내역 파싱
  let ioprData: any = null;
  if (ioprResponse.data) {
    try {
      const parsedIopr = xmlParser.parse(ioprResponse.data);
      ioprData = parsedIopr?.ioprRprtBrkdQryRtnVo || null;
      
      if (ioprData && ioprData.etprRprtQryBrkdQryVo) {
        console.log("=== API024 입출항보고 응답 성공 ===");
        const items = normalizeToArray(ioprData.etprRprtQryBrkdQryVo);
        console.log(`총 ${items.length}건의 입출항보고 내역`);
        
        // ioprSbmtNo가 일치하는 항목 찾기
        const matchingItem = items.find((item: any) => item.ioprSbmtNo === ioprSbmtNo);
        if (matchingItem) {
          console.log("=== 일치하는 입출항보고 발견 ===");
          console.log(JSON.stringify(matchingItem, null, 2));
        }
      }
    } catch (e) {
      console.log("=== API024 파싱 에러 ===", String(e).substring(0, 200));
    }
  }
  
  return {
    result: parseUnipassResponse(cargoData, containerData, ioprData, ioprSbmtNo),
    rawApiData: cargoData,
  };
}

// 인증 미들웨어
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "로그인이 필요합니다." });
  }
  next();
}

// 관리자 권한 미들웨어
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || req.session.role !== 'admin') {
    return res.status(403).json({ error: "관리자 권한이 필요합니다." });
  }
  next();
}

// 세션에서 userId 추출 및 검증
function getSessionUserId(req: Request, res: Response): number | null {
  if (!req.session.userId) {
    res.status(401).json({ error: "로그인이 필요합니다." });
    return null;
  }
  return req.session.userId;
}

// 사용자별 데이터 스코프 적용 헬퍼 (inboundList, manifestResults만 해당)
function withUserScope(table: typeof inboundList | typeof manifestResults) {
  return (userId: number) => eq(table.userId, userId);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // 인증 API
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      console.log(`[LOGIN] 로그인 시도: username=${username}`);
      
      if (!username || !password) {
        console.log(`[LOGIN] 실패: 사용자명 또는 비밀번호 누락`);
        return res.status(400).json({ error: "사용자명과 비밀번호를 입력하세요." });
      }
      
      // 사용자 조회
      const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
      
      if (!user) {
        console.log(`[LOGIN] 실패: 사용자를 찾을 수 없음 - username=${username}`);
        return res.status(401).json({ error: "사용자명 또는 비밀번호가 올바르지 않습니다." });
      }
      
      // 비밀번호 확인
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      
      if (!isValidPassword) {
        console.log(`[LOGIN] 실패: 비밀번호 불일치 - username=${username}`);
        return res.status(401).json({ error: "사용자명 또는 비밀번호가 올바르지 않습니다." });
      }
      
      // 세션에 사용자 정보 저장
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;
      
      console.log(`[LOGIN] 성공: username=${username}, role=${user.role}`);
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
      });
    } catch (error: any) {
      console.error("[LOGIN] 오류 발생:", {
        error: error?.message || String(error),
        stack: error?.stack,
        username: req.body?.username,
      });
      res.status(500).json({ 
        error: "로그인 중 오류가 발생했습니다.",
        details: process.env.NODE_ENV === "development" ? error?.message : undefined
      });
    }
  });
  
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "로그아웃 중 오류가 발생했습니다." });
      }
      res.json({ message: "로그아웃되었습니다." });
    });
  });
  
  app.get('/api/auth/me', (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "로그인이 필요합니다." });
    }
    
    res.json({
      id: req.session.userId,
      username: req.session.username,
      role: req.session.role,
    });
  });
  
  // 관리자 API - 사용자 목록 조회
  app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const allUsers = await db.select({
        id: users.id,
        username: users.username,
        role: users.role,
        createdAt: users.createdAt,
      }).from(users).orderBy(desc(users.createdAt));
      
      res.json(allUsers);
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "사용자 목록 조회 중 오류가 발생했습니다." });
    }
  });
  
  // 관리자 API - 사용자 추가
  app.post('/api/admin/users', requireAdmin, async (req, res) => {
    try {
      const { username, password, role } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "사용자명과 비밀번호를 입력하세요." });
      }
      
      // 중복 체크
      const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);
      
      if (existing) {
        return res.status(400).json({ error: "이미 존재하는 사용자명입니다." });
      }
      
      // 비밀번호 해싱
      const passwordHash = await bcrypt.hash(password, 12);
      
      // 사용자 생성
      const [newUser] = await db.insert(users).values({
        username,
        passwordHash,
        role: role || 'user',
      }).returning({
        id: users.id,
        username: users.username,
        role: users.role,
        createdAt: users.createdAt,
      });
      
      res.json(newUser);
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "사용자 생성 중 오류가 발생했습니다." });
    }
  });
  
  // 관리자 API - 사용자 삭제
  app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      if (isNaN(userId)) {
        return res.status(400).json({ error: "잘못된 사용자 ID입니다." });
      }
      
      // 자기 자신은 삭제 불가
      if (userId === req.session.userId) {
        return res.status(400).json({ error: "자기 자신은 삭제할 수 없습니다." });
      }
      
      await db.delete(users).where(eq(users.id, userId));
      
      res.json({ message: "사용자가 삭제되었습니다." });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "사용자 삭제 중 오류가 발생했습니다." });
    }
  });

  app.post('/api/track', async (req, res) => {
    try {
      const { searchType, queries } = req.body;

      if (!searchType || !queries || !Array.isArray(queries)) {
        return res.status(400).json({ 
          error: "잘못된 요청 형식입니다." 
        });
      }

      if (queries.length === 0) {
        return res.status(400).json({ 
          error: "검색할 항목을 입력하세요." 
        });
      }

      // Process all queries in parallel with concurrency limit
      const results = await Promise.allSettled(
        queries.map((query: { value: string; year?: string; lineNumber: number }) => 
          fetchSingleCargo(searchType, query.value, query.year)
        )
      );

      // Format results
      const formattedResults = results.map((result, index) => {
        const query = queries[index];
        const inputString = query.year 
          ? `${query.value};${query.year}` 
          : query.value;

        if (result.status === 'fulfilled') {
          return {
            input: inputString,
            lineNumber: query.lineNumber,
            result: result.value.result
          };
        } else {
          const errorMessage = result.reason instanceof Error 
            ? result.reason.message 
            : "조회 중 오류가 발생했습니다.";
          
          return {
            input: inputString,
            lineNumber: query.lineNumber,
            error: errorMessage
          };
        }
      });

      res.json(formattedResults);

    } catch (error) {
      console.error("Batch track API error:", error);
      
      if (error instanceof Error) {
        return res.status(400).json({ error: error.message });
      }

      res.status(500).json({ 
        error: "데이터 조회 중 오류가 발생했습니다." 
      });
    }
  });

  app.get("/api/excel-manifest", async (req, res) => {
    try {
      const attachedAssetsDir = path.join(process.cwd(), "attached_assets");
      const files = fs.readdirSync(attachedAssetsDir);
      
      // JSON 파일 우선 (정확한 스타일 정보 포함)
      console.log("Looking for JSON files in:", files.filter(f => f.endsWith('.json')));
      let jsonFile = files.find(f => f.endsWith('.json') && f.includes('서식'));
      console.log("JSON file found:", jsonFile);
      
      if (jsonFile) {
        console.log("Found JSON style file:", jsonFile);
        const jsonPath = path.join(attachedAssetsDir, jsonFile);
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        
        // JSON 데이터를 테이블 형식으로 변환
        const cellMap = new Map();
        jsonData.forEach((cell: any) => {
          cellMap.set(cell.cell, cell);
        });
        
        // 행/열 범위 찾기
        let maxRow = 0;
        let maxCol = 0;
        jsonData.forEach((cell: any) => {
          const match = cell.cell.match(/([A-Z]+)(\d+)/);
          if (match) {
            const col = match[1].charCodeAt(0) - 65; // A=0, B=1, ...
            const row = parseInt(match[2]) - 1;
            maxRow = Math.max(maxRow, row);
            maxCol = Math.max(maxCol, col);
          }
        });
        
        const rows: any[] = [];
        const processed = new Set<string>();
        
        for (let r = 0; r <= maxRow; r++) {
          const cells: any[] = [];
          
          for (let c = 0; c <= maxCol; c++) {
            const cellAddress = String.fromCharCode(65 + c) + (r + 1);
            
            if (processed.has(cellAddress)) {
              cells.push(null);
              continue;
            }
            
            const cellInfo = cellMap.get(cellAddress);
            const cellData: any = {
              value: cellInfo?.value === 'None' ? '' : (cellInfo?.value || ''),
              rowSpan: 1,
              colSpan: 1,
              style: {}
            };
            
            // 병합 처리
            if (cellInfo?.merge_range && cellInfo.merge_range !== 'None') {
              const merge = cellInfo.merge_range; // e.g., "B2:J2"
              const [start, end] = merge.split(':');
              const startMatch = start.match(/([A-Z]+)(\d+)/);
              const endMatch = end.match(/([A-Z]+)(\d+)/);
              
              if (startMatch && endMatch) {
                const startCol = startMatch[1].charCodeAt(0) - 65;
                const startRow = parseInt(startMatch[2]) - 1;
                const endCol = endMatch[1].charCodeAt(0) - 65;
                const endRow = parseInt(endMatch[2]) - 1;
                
                cellData.rowSpan = endRow - startRow + 1;
                cellData.colSpan = endCol - startCol + 1;
                
                // 병합된 셀 마킹
                for (let mr = startRow; mr <= endRow; mr++) {
                  for (let mc = startCol; mc <= endCol; mc++) {
                    if (mr !== startRow || mc !== startCol) {
                      processed.add(String.fromCharCode(65 + mc) + (mr + 1));
                    }
                  }
                }
              }
            }
            
            // 스타일 적용
            if (cellInfo) {
              // 폰트 색상
              if (cellInfo.font_color && cellInfo.font_color !== 'None') {
                cellData.style.color = '#' + cellInfo.font_color.substring(2); // FFFF0000 -> FF0000
              }
              
              // 배경색
              if (cellInfo.fill_color && cellInfo.fill_color !== '00000000') {
                cellData.style.backgroundColor = '#' + cellInfo.fill_color.substring(2);
              }
              
              // 볼드
              if (cellInfo.bold === 'True') {
                cellData.style.fontWeight = 'bold';
              }
              
              // 폰트 크기
              if (cellInfo.font_size) {
                cellData.style.fontSize = cellInfo.font_size + 'pt';
              }
              
              // 정렬
              if (cellInfo.alignment_horizontal && cellInfo.alignment_horizontal !== 'None') {
                cellData.style.textAlign = cellInfo.alignment_horizontal;
              }
              if (cellInfo.alignment_vertical && cellInfo.alignment_vertical !== 'None') {
                cellData.style.verticalAlign = cellInfo.alignment_vertical;
              }
              
              // 테두리
              if (cellInfo.border) {
                const borderStyles: any = {};
                if (cellInfo.border.top && cellInfo.border.top !== 'None') {
                  borderStyles.borderTop = cellInfo.border.top === 'medium' ? '2px solid black' : '1px solid black';
                }
                if (cellInfo.border.bottom && cellInfo.border.bottom !== 'None') {
                  borderStyles.borderBottom = cellInfo.border.bottom === 'medium' ? '2px solid black' : '1px solid black';
                }
                if (cellInfo.border.left && cellInfo.border.left !== 'None') {
                  borderStyles.borderLeft = cellInfo.border.left === 'medium' ? '2px solid black' : '1px solid black';
                }
                if (cellInfo.border.right && cellInfo.border.right !== 'None') {
                  borderStyles.borderRight = cellInfo.border.right === 'medium' ? '2px solid black' : '1px solid black';
                }
                Object.assign(cellData.style, borderStyles);
              }
            }
            
            cells.push(cellData);
          }
          
          rows.push({ cells });
        }
        
        return res.json({ rows });
      }
      
      // JSON 없으면 기존 방식 (엑셀 파일)
      let excelFile = files.find(f => f.endsWith('.xlsx'));
      if (!excelFile) {
        excelFile = files.find(f => f.endsWith('.xls'));
      }
      
      if (!excelFile) {
        console.log("No Excel file found in attached_assets");
        console.log("Available files:", files.filter(f => f.includes('양식')));
        return res.status(404).json({ error: "엑셀 파일을 찾을 수 없습니다." });
      }
      
      const excelPath = path.join(attachedAssetsDir, excelFile);
      console.log("Found Excel file:", excelFile);

      const workbook = XLSX.readFile(excelPath, { 
        cellStyles: true,
        cellNF: true,
        cellHTML: false
      });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const rows: any[] = [];
      
      const merges = worksheet['!merges'] || [];
      const processed = new Set<string>();

      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cells: any[] = [];
        
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          
          if (processed.has(cellAddress)) {
            cells.push(null);
            continue;
          }

          const cell = worksheet[cellAddress];
          const cellValue = cell ? (cell.v || '') : '';
          
          let cellData: any = {
            value: cellValue,
            rowSpan: 1,
            colSpan: 1,
            style: {}
          };

          const merge = merges.find((m: any) => 
            m.s.r === R && m.s.c === C
          );

          if (merge) {
            cellData.rowSpan = merge.e.r - merge.s.r + 1;
            cellData.colSpan = merge.e.c - merge.s.c + 1;
            
            for (let mr = merge.s.r; mr <= merge.e.r; mr++) {
              for (let mc = merge.s.c; mc <= merge.e.c; mc++) {
                if (mr !== merge.s.r || mc !== merge.s.c) {
                  processed.add(XLSX.utils.encode_cell({ r: mr, c: mc }));
                }
              }
            }
          }

          // 값 기반 스타일 매핑 (엑셀 파일에 스타일이 없으므로)
          const valueStr = String(cellValue).trim();
          
          // 빨간색 숫자들 (2-25)
          if (/^(1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24|25)$/.test(valueStr)) {
            cellData.style.color = '#FF0000';
            cellData.style.fontWeight = 'bold';
            
            // "12"는 특별히 크게
            if (valueStr === '12') {
              cellData.style.fontSize = '72pt';
            }
          }
          
          // "DRY/WET-7"도 빨간색
          if (valueStr.includes('DRY/WET')) {
            cellData.style.color = '#FF0000';
            cellData.style.fontWeight = 'bold';
          }
          
          // "PALLET 적재정보"는 볼드
          if (valueStr.includes('PALLET')) {
            cellData.style.fontWeight = 'bold';
          }
          
          // 엑셀 파일의 기존 스타일도 적용 (있다면)
          if (cell?.s) {
            const style = cell.s;
            
            if (style.fgColor?.rgb) {
              cellData.style.backgroundColor = `#${style.fgColor.rgb}`;
            }
            
            if (style.font?.color?.rgb) {
              cellData.style.color = `#${style.font.color.rgb}`;
            }
            
            if (style.font?.bold) {
              cellData.style.fontWeight = 'bold';
            }
            
            if (style.font?.sz) {
              cellData.style.fontSize = `${style.font.sz}pt`;
            }
            
            if (style.alignment?.horizontal) {
              cellData.style.textAlign = style.alignment.horizontal;
            }
            
            if (style.alignment?.vertical) {
              cellData.style.verticalAlign = style.alignment.vertical;
            }
          }

          cells.push(cellData);
        }
        
        rows.push({ cells });
      }

      res.json({ rows });
    } catch (error) {
      console.error("Excel parsing error:", error);
      res.status(500).json({ 
        error: "엑셀 파일 파싱 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Multer 설정 (메모리에 저장)
  const upload = multer({ storage: multer.memoryStorage() });

  // 엑셀 파일 업로드 및 데이터베이스 저장
  app.post("/api/inbound/upload", requireAuth, upload.single("file"), async (req, res) => {
    try {
      const userId = getSessionUserId(req, res);
      if (!userId) return;
      
      if (!req.file) {
        return res.status(400).json({ error: "파일이 업로드되지 않았습니다." });
      }

      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(ws);

      // 디버깅: 엑셀 컬럼명 확인
      if (jsonData.length > 0) {
        const firstRow = jsonData[0] as Record<string, any>;
        console.log("\n=== 엑셀 파일 컬럼명 ===");
        console.log(Object.keys(firstRow));
        console.log("\n=== Pallet 관련 컬럼 상세 ===");
        Object.keys(firstRow).forEach(key => {
          if (key.toLowerCase().includes('pallet') || key.toLowerCase().includes('mpk')) {
            console.log(`"${key}": ${firstRow[key]}`);
          }
        });
        console.log("\n=== 첫 번째 행 데이터 샘플 ===");
        console.log(JSON.stringify(firstRow, null, 2));
      }

      const insertData: InsertInboundList[] = jsonData.map((row: any) => ({
        userId,
        반입번호: row["반입번호"] || null,
        no: row["No."] ? String(row["No."]) : null,
        도착Time: row["도착\nTime"] || row["도착 Time"] || null,
        출발Time: row["출발\nTime"] || row["출발 Time"] || null,
        도착예정Time: row["도착\n예정\nTIME"] || row["도착 예정 TIME"] || null,
        blNo: row["B/L No."] || null,
        itemNo: row["Item No."] || null,
        dept: row["Dept"] || null,
        description: row["Description"] || null,
        qty: row["QTY"] ? String(row["QTY"]) : null,
        qty_이상유무: row["QTY_이상\n유무"] || row["QTY_이상 유무"] || null,
        containerCntrNo: row["CONTAINER_Cntr No."] || null,
        containerSealNo: row["CONTAINER_Seal No."] || null,
        containerTemp: row["CONTAINER_TEMP"] || null,
        container_파손유무: row["CONTAINER_파손\n유무"] || row["CONTAINER_파손 유무"] || null,
        palletQty: (row["Pallet\nQ'ty"] || row["Pallet Q'ty"]) ? String(row["Pallet\nQ'ty"] || row["Pallet Q'ty"]) : null,
        mpk: (row["MPK"] || row["mpk"]) ? String(row["MPK"] || row["mpk"]) : null,
        box: row["BOX"] ? String(row["BOX"]) : null,
        unit: row["UNIT"] ? String(row["UNIT"]) : null,
        palletType: row["Pallet\ntype"] || row["Pallet type"] || null,
        제품확인_블록: row["제품확인_블록 (WG 아님)"] || row["제품확인_블록"] || null,
        제품확인Coo: row["제품확인_COO"] || null,
        제품확인Remark: row["제품확인_Remark"] || null,
        수작업_유형: row["수작업 유형"] || null,
        차량번호: row["차량번호"] || null,
        비고: row["비고"] || null,
        구분: row["구분"] || null,
        수입자: row["수입자"] || null,
        costcoBlNo: row["Costco B/L No."] || null,
        tie: row["TIE"] ? String(row["TIE"]) : null,
        높이: row["높이"] ? String(row["높이"]) : null,
        반입일자: excelDateToISODate(row["반입일자"]),
        plt: row["PLT"] ? String(row["PLT"]) : null,
        매수: row["매수"] ? String(row["매수"]) : null,
      }));

      await db.insert(inboundList).values(insertData);

      res.json({ 
        success: true, 
        message: `${insertData.length}개의 항목이 추가되었습니다.`,
        count: insertData.length 
      });
    } catch (error) {
      console.error("Excel upload error:", error);
      res.status(500).json({ 
        error: "엑셀 파일 업로드 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 입고리스트 전체 조회
  app.get("/api/inbound", requireAuth, async (req, res) => {
    try {
      const userId = getSessionUserId(req, res);
      if (!userId) return;
      
      // 모든 사용자의 입고리스트 조회 (ID 오름차순 정렬로 순서 유지)
      const items = await db.select().from(inboundList).orderBy(inboundList.id);
      res.json(items);
    } catch (error) {
      console.error("Inbound list fetch error:", error);
      res.status(500).json({ 
        error: "입고리스트 조회 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 입고리스트 항목 업데이트
  app.put("/api/inbound/:id", requireAuth, async (req, res) => {
    try {
      const userId = getSessionUserId(req, res);
      if (!userId) return;
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID입니다." });
      }
      
      // 입력 검증
      const { updateInboundListSchema } = await import("@shared/schema");
      const { z } = await import("zod");
      
      let validatedData;
      try {
        validatedData = updateInboundListSchema.parse(req.body);
      } catch (zodError) {
        if (zodError instanceof z.ZodError) {
          return res.status(400).json({ 
            error: "입력 데이터가 유효하지 않습니다.",
            details: zodError.errors 
          });
        }
        throw zodError;
      }
      
      // 반입일자 Date → string 변환
      const updateData = { ...validatedData };
      if (updateData.반입일자 instanceof Date) {
        updateData.반입일자 = updateData.반입일자.toISOString().split('T')[0];
      }
      
      // 트랜잭션으로 일관성 보장
      // manifest_results 업데이트는 트랜잭션 밖에서 처리 (실패해도 inbound_list 업데이트는 유지)
      const result = await db.transaction(async (tx) => {
        // 1. 권한 확인 (공유 데이터이지만 자신이 업로드한 것만 수정 가능)
        const existing = await tx.select().from(inboundList)
          .where(and(eq(inboundList.id, id), eq(inboundList.userId, userId)))
          .limit(1);
        
        if (existing.length === 0) {
          throw new Error("NOT_FOUND");
        }
        
        // 2. inbound_list 업데이트
        const updateResult = await tx.update(inboundList)
          .set(updateData as any)
          .where(eq(inboundList.id, id));
        
        if (updateResult.rowCount === 0) {
          throw new Error("UPDATE_FAILED");
        }
        
        // 3. 업데이트된 데이터 가져오기
        const updated = await tx.select().from(inboundList)
          .where(eq(inboundList.id, id))
          .limit(1);
        
        if (updated.length === 0) {
          throw new Error("UPDATE_FAILED");
        }
        
        // 트랜잭션 커밋 (inbound_list 업데이트는 확실히 저장)
        return updated[0];
      });
      
      // 4. manifest_results 업데이트는 트랜잭션 밖에서 처리 (실패해도 inbound_list는 이미 저장됨)
      let manifestUpdated = false;
      try {
        const inboundFields = extractInboundFields(result);
        const manifestResult = await db.update(manifestResults)
          .set(inboundFields)
          .where(eq(manifestResults.inboundListId, id));
        manifestUpdated = manifestResult.rowCount ? manifestResult.rowCount > 0 : false;
      } catch (error: any) {
        // manifest_results 테이블이 없거나 에러가 발생해도 입고리스트 업데이트는 이미 성공
        console.warn("⚠️ manifest_results 업데이트 실패 (무시됨):", error?.message || error);
        manifestUpdated = false;
      }
      
      res.json({
        success: true,
        updated: result,
        manifestUpdated,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "NOT_FOUND") {
        return res.status(404).json({ error: "입고리스트 항목을 찾을 수 없습니다." });
      }
      console.error("Inbound update error:", error);
      res.status(500).json({ 
        error: "업데이트 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 입고리스트 전체 초기화 (비밀번호 필요) - :id보다 먼저 매칭되어야 함
  app.delete("/api/inbound/reset", requireAuth, async (req, res) => {
    try {
      const userId = getSessionUserId(req, res);
      if (!userId) return;
      
      const { password } = req.body;
      
      // 비밀번호 확인
      const RESET_PASSWORD = "reset123";
      
      if (password !== RESET_PASSWORD) {
        return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
      }
      
      // 현재 사용자의 모든 입고리스트 데이터 삭제
      await db.delete(inboundList).where(eq(inboundList.userId, userId));
      
      res.json({ success: true, message: "모든 입고리스트 데이터가 삭제되었습니다." });
    } catch (error) {
      console.error("Inbound list reset error:", error);
      res.status(500).json({ 
        error: "초기화 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 입고리스트 항목 삭제
  app.delete("/api/inbound/:id", requireAuth, async (req, res) => {
    try {
      const userId = getSessionUserId(req, res);
      if (!userId) return;
      
      const inboundId = parseInt(req.params.id);
      
      // 소유권 확인
      const row = await db.select().from(inboundList)
        .where(and(eq(inboundList.id, inboundId), eq(inboundList.userId, userId)))
        .limit(1);
      
      if (!row.length) {
        return res.status(404).json({ error: "존재하지 않거나 접근 권한이 없습니다." });
      }
      
      await db.delete(inboundList).where(eq(inboundList.id, inboundId));
      res.json({ success: true, message: "삭제되었습니다." });
    } catch (error) {
      console.error("Inbound list delete error:", error);
      res.status(500).json({ 
        error: "삭제 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 입고리스트 항목으로 화물표 데이터 생성 (입고리스트 + Unipass API)
  app.get("/api/inbound/:id/manifest", requireAuth, async (req, res) => {
    try {
      const userId = getSessionUserId(req, res);
      if (!userId) return;
      
      const { id } = req.params;
      
      // 입고리스트 조회 (사용자 필터 적용)
      const items = await db.select().from(inboundList)
        .where(and(eq(inboundList.id, parseInt(id)), eq(inboundList.userId, userId)));
      if (items.length === 0) {
        return res.status(404).json({ error: "입고리스트 항목을 찾을 수 없습니다." });
      }
      
      const inbound = items[0];
      
      // B/L No.가 없으면 입고리스트 데이터만 반환
      if (!inbound.blNo) {
        return res.json({
          품명: inbound.description || "-",
          수량: inbound.mpk || "-",
          중량: "-",
          입항일자: "-",
          contNo: inbound.containerCntrNo || "-",
          화물종류: "-",
          dryWet: inbound.구분 || "-",
          수출국명: "-",
          선명: "-",
          검역사항: "검역완료 □",
          경유지: "-",
          blNo: inbound.blNo || "-",
          화물관리번호: "-",
          수입자: inbound.수입자 || "-",
          반입일자: excelDateToString(inbound.반입일자),
          palletQty: inbound.palletQty || "-",
          plt: inbound.plt || "-",
          매수: inbound.매수 || "-",
          bl수량: inbound.qty || "-",
          tie: inbound.tie || "-",
          sellUnitPerCase: inbound.unit || "-",
          do: inbound.dept ? `D${inbound.dept}` : "-",
          itemNo: inbound.itemNo ? `#${inbound.itemNo}` : "-",
          수량Pcs: inbound.mpk || "-",
          높이: inbound.높이 || "-",
          소비기한: inbound.도착예정Time || "-",
          특이사항: inbound.비고 || "-",
          costcoBlNo: inbound.costcoBlNo || "-",
        });
      }

      // Unipass API 조회 (API019만 사용)
      try {
        const apiUrl = `${UNIPASS_API_URL}?crkyCn=${API_KEY}&mblNo=${inbound.blNo}&blYy=2024`;
        const response = await axios.get(apiUrl, { timeout: 10000 });
        const parsed = xmlParser.parse(response.data);
        
        const cargCsclPrgsInfoQryRsltVo = parsed?.cargCsclPrgsInfoQryRsltVo || parsed?.cargCsclPrgsInfoQryVo;
        
        if (!cargCsclPrgsInfoQryRsltVo || cargCsclPrgsInfoQryRsltVo.tCnt === 0) {
          // API 조회 실패 시 입고리스트 데이터만 반환
          return res.json({
            품명: inbound.description || "-",
            수량: inbound.mpk || "-",
            중량: "-",
            입항일자: "-",
            contNo: inbound.containerCntrNo || "-",
            화물종류: "-",
            dryWet: inbound.구분 || "-",
            수출국명: "-",
            선명: "-",
            검역사항: "검역완료 □",
            경유지: "-",
            blNo: inbound.blNo || "-",
            화물관리번호: "-",
            수입자: inbound.수입자 || "-",
            반입일자: excelDateToString(inbound.반입일자),
            palletQty: inbound.palletQty || "-",
            plt: inbound.plt || "-",
            매수: inbound.매수 || "-",
            bl수량: inbound.qty || "-",
            tie: inbound.tie || "-",
            sellUnitPerCase: inbound.costcoBlNo || "-",
            do: inbound.dept || "-",
            itemNo: inbound.itemNo || "-",
            수량Pcs: inbound.box || "-",
            높이: inbound.높이 || "-",
            소비기한: inbound.도착예정Time || "-",
            특이사항: inbound.비고 || "-",
          });
        }

        const csclPrgsInfoDtlQryVos = normalizeToArray(cargCsclPrgsInfoQryRsltVo.csclPrgsInfoDtlQryVo);
        const apiData = csclPrgsInfoDtlQryVos[0] || {};

        // 입고리스트 + Unipass 데이터 병합
        const manifestData = {
          // 1: 품명 - Description (입고리스트)
          품명: inbound.description || "-",
          // 2: 수량 - Unipass 포장개수 우선, 없으면 입고리스트 mpk
          수량: apiData.pckGcnt || inbound.mpk || "-",
          // 3: 중량 - Unipass
          중량: apiData.ttwt ? `${apiData.ttwt} KG` : "-",
          // 4: 입항일자 - Unipass
          입항일자: formatDate(apiData.etprDt) || "-",
          // 5: CON'T No. - CONTAINER_Cntr No. (입고리스트) 또는 Unipass
          contNo: inbound.containerCntrNo || "-",
          // 6: 화물종류 - Unipass
          화물종류: apiData.cargTp === "F" ? "FCL" : apiData.cargTp === "L" ? "LCL" : apiData.cargTp || "-",
          // 7: DRY/WET - 구분 (입고리스트)
          dryWet: inbound.구분 || "-",
          // 8: 수출국명 - Unipass
          수출국명: apiData.shcoFlco || "-",
          // 9: 선명 - Unipass
          선명: apiData.shipNat || "-",
          // 10: 검역사항 - 고유값
          검역사항: "검역완료 □",
          // 11: 경유지 - Unipass (비움)
          경유지: "-",
          // 12: B/L No. - B/L No. (입고리스트)
          blNo: inbound.blNo || "-",
          // 13: 화물관리번호 - Unipass
          화물관리번호: apiData.cargMtNo || "-",
          // 14: 수입자 - 수입자 (입고리스트)
          수입자: inbound.수입자 || "-",
          // 15: 반입일자 - 반입일자 (입고리스트)
          반입일자: excelDateToString(inbound.반입일자),
          // 16: PLT - Pallet Q'ty (입고리스트)
          palletQty: inbound.palletQty || "-",
          plt: inbound.plt || "-",
          매수: inbound.매수 || "-",
          // 17: B/L수량 - QTY (입고리스트)
          bl수량: inbound.qty || "-",
          // 18: TIE - TIE (입고리스트)
          tie: inbound.tie || "-",
          // 19: SELL UNIT PER CASE - Costco B/L No. (입고리스트)
          sellUnitPerCase: inbound.costcoBlNo || "-",
          // 20: DO - Dept (입고리스트)
          do: inbound.dept || "-",
          // 21: item No. - Item No. (입고리스트)
          itemNo: inbound.itemNo || "-",
          // 22: 수량(PCS) - BOX (입고리스트)
          수량Pcs: inbound.box || "-",
          // 23: 높이 - 높이 (입고리스트)
          높이: inbound.높이 || "-",
          // 24: 소비기한 - 도착예정Time (입고리스트)
          소비기한: inbound.도착예정Time || "-",
          // 25: 특이사항 - 비고 (입고리스트)
          특이사항: inbound.비고 || "-",
        };

        res.json(manifestData);
      } catch (apiError) {
        console.error("Unipass API error:", apiError);
        // API 오류 시 입고리스트 데이터만 반환
        return res.json({
          품명: inbound.description || "-",
          수량: inbound.mpk || "-",
          중량: "-",
          입항일자: "-",
          contNo: inbound.containerCntrNo || "-",
          화물종류: "-",
          dryWet: inbound.구분 || "-",
          수출국명: "-",
          선명: "-",
          검역사항: "검역완료 □",
          경유지: "-",
          blNo: inbound.blNo || "-",
          화물관리번호: "-",
          수입자: inbound.수입자 || "-",
          반입일자: excelDateToString(inbound.반입일자),
          palletQty: inbound.palletQty || "-",
          plt: inbound.plt || "-",
          매수: inbound.매수 || "-",
          bl수량: inbound.qty || "-",
          tie: inbound.tie || "-",
          sellUnitPerCase: inbound.unit || "-",
          do: inbound.dept ? `D${inbound.dept}` : "-",
          itemNo: inbound.itemNo ? `#${inbound.itemNo}` : "-",
          수량Pcs: inbound.mpk || "-",
          높이: inbound.높이 || "-",
          소비기한: inbound.도착예정Time || "-",
          특이사항: inbound.비고 || "-",
          costcoBlNo: inbound.costcoBlNo || "-",
        });
      }
    } catch (error) {
      console.error("Manifest generation error:", error);
      res.status(500).json({ 
        error: "화물표 데이터 생성 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 세 테이블 조인하여 모든 원시 필드 반환 (템플릿 렌더링용)
  app.get("/api/inbound/:id/full-data", requireAuth, async (req, res) => {
    try {
      const userId = getSessionUserId(req, res);
      if (!userId) return;
      
      const inboundId = parseInt(req.params.id);
      if (isNaN(inboundId)) {
        return res.status(400).json({ error: "잘못된 입고리스트 ID입니다." });
      }

      // 1. 입고리스트 데이터 조회 (사용자 필터 적용)
      const inboundData = await db.select()
        .from(inboundList)
        .where(and(eq(inboundList.id, inboundId), eq(inboundList.userId, userId)))
        .limit(1);

      if (!inboundData || inboundData.length === 0) {
        return res.status(404).json({ error: "입고리스트 항목을 찾을 수 없습니다." });
      }

      const inbound = inboundData[0];

      // 2. 유니패스 원시 데이터 조회
      const unipassData = await db.select()
        .from(unipassCargoData)
        .where(eq(unipassCargoData.inboundListId, inboundId))
        .limit(1);

      // 3. 화물표 결과 데이터 조회
      const manifestData = await db.select()
        .from(manifestResults)
        .where(eq(manifestResults.inboundListId, inboundId))
        .limit(1);

      // 4. 세 테이블 데이터 통합 반환
      const fullData = {
        // 입고리스트 (32개 필드)
        inbound: inbound,
        // 유니패스 API 원시 데이터 (존재하는 경우)
        unipass: unipassData.length > 0 ? unipassData[0] : null,
        // 화물표 결과 (26개 필드, 존재하는 경우)
        manifest: manifestData.length > 0 ? manifestData[0] : null,
      };

      res.json(fullData);
    } catch (error) {
      console.error("Full data fetch error:", error);
      res.status(500).json({ 
        error: "전체 데이터 조회 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 구분 목록 조회 (드롭다운용) - DRY/WET로 그룹화
  app.get("/api/inbound/categories", requireAuth, async (req, res) => {
    try {
      const userId = getSessionUserId(req, res);
      if (!userId) return;
      
      // 모든 사용자의 데이터 조회 (userId 필터 제거)
      const items = await db.select({
        구분: inboundList.구분,
      }).from(inboundList);

      // 고유한 구분 값 추출 및 그룹화
      const categorySet = new Set<string>();
      items.forEach(item => {
        if (item.구분 && item.구분.trim()) {
          const category = item.구분.trim();
          // 냉동 또는 냉장 → WET, DRY → DRY
          if (category === "냉동" || category === "냉장") {
            categorySet.add("WET");
          } else if (category === "DRY") {
            categorySet.add("DRY");
          }
        }
      });

      // 정렬 (DRY 먼저, WET 나중)
      const categoryList = Array.from(categorySet).sort();
      res.json(categoryList);
    } catch (error) {
      console.error("Category list fetch error:", error);
      res.status(500).json({ error: "구분 목록을 가져오는 중 오류가 발생했습니다." });
    }
  });

  // 반입일자 목록 조회 (드롭다운용)
  app.get("/api/inbound/dates", requireAuth, async (req, res) => {
    try {
      const userId = getSessionUserId(req, res);
      if (!userId) return;
      
      // 모든 사용자의 데이터 조회 (userId 필터 제거)
      const items = await db.select({
        반입일자: inboundList.반입일자,
      }).from(inboundList);

      // 고유한 반입일자 목록 추출
      const dateSet = new Set<string>();
      items.forEach(item => {
        if (item.반입일자 && item.반입일자.trim()) {
          dateSet.add(item.반입일자.trim());
        }
      });

      // 날짜 정렬 (최신순)
      const dateList = Array.from(dateSet).sort().reverse();
      res.json(dateList);
    } catch (error) {
      console.error("Date list fetch error:", error);
      res.status(500).json({ error: "반입일자 목록을 가져오는 중 오류가 발생했습니다." });
    }
  });

  // B/L 목록 조회 (드롭다운용, 구분 및 반입일자 필터링 지원)
  app.get("/api/inbound/bl-list", requireAuth, async (req, res) => {
    try {
      const userId = getSessionUserId(req, res);
      if (!userId) return;
      
      const category = req.query.category as string | undefined;
      const date = req.query.date as string | undefined;
      
      // 모든 사용자의 데이터 조회 (userId 필터 제거)
      const items = await db.select({
        blNo: inboundList.blNo,
        구분: inboundList.구분,
        반입일자: inboundList.반입일자,
      }).from(inboundList);

      // 필터링
      let filtered = items;
      
      // 구분 필터링
      if (category && category.trim()) {
        filtered = filtered.filter(item => {
          if (!item.구분) return false;
          const itemCategory = item.구분.trim();
          
          if (category === "WET") {
            return itemCategory === "냉동" || itemCategory === "냉장";
          } else if (category === "DRY") {
            return itemCategory === "DRY";
          }
          return false;
        });
      }
      
      // 반입일자 필터링
      if (date && date.trim()) {
        filtered = filtered.filter(item => item.반입일자 === date.trim());
      }

      // 고유한 B/L 번호 목록 추출
      const blSet = new Set<string>();
      filtered.forEach(item => {
        if (item.blNo && item.blNo.trim()) blSet.add(item.blNo.trim());
      });

      const blList = Array.from(blSet).sort();
      res.json(blList);
    } catch (error) {
      console.error("B/L list fetch error:", error);
      res.status(500).json({ error: "B/L 목록을 가져오는 중 오류가 발생했습니다." });
    }
  });

  // 선택된 B/L들에 대응하는 Item No. 목록 조회
  app.get("/api/inbound/items-by-bl", requireAuth, async (req, res) => {
    try {
      const userId = getSessionUserId(req, res);
      if (!userId) return;
      
      const blNos = req.query.blNos as string;
      if (!blNos) {
        return res.status(400).json({ error: "B/L 번호를 선택하세요." });
      }

      const blArray = blNos.split(',').map(bl => bl.trim()).filter(bl => bl);
      
      // 모든 사용자의 데이터 조회 (userId 필터 제거)
      const items = await db.select().from(inboundList);
      
      // 선택된 B/L들에 대응하는 항목들 필터링 (blNo만 사용)
      const filtered = items.filter(item => 
        blArray.includes(item.blNo || '')
      );

      // Item No.와 함께 필요한 정보 반환
      const itemList = filtered.map(item => ({
        id: item.id,
        itemNo: item.itemNo || '-',
        blNo: item.blNo || '-',
        품명: item.description || '-',
      }));

      res.json(itemList);
    } catch (error) {
      console.error("Items by B/L fetch error:", error);
      res.status(500).json({ error: "Item No. 목록을 가져오는 중 오류가 발생했습니다." });
    }
  });

  // 선택된 Item ID들에 대해 화물 추적 데이터 생성 (배치)
  app.post("/api/inbound/manifests-batch", requireAuth, async (req, res) => {
    try {
      const userId = getSessionUserId(req, res);
      if (!userId) return;
      
      const { itemIds } = req.body as { itemIds: number[] };
      
      if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        return res.status(400).json({ error: "Item ID를 선택하세요." });
      }

      const results = [];

      for (const itemId of itemIds) {
        const inbound = await db.select().from(inboundList)
          .where(eq(inboundList.id, itemId)).limit(1);
        
        if (!inbound || inbound.length === 0) {
          results.push({
            input: `Item ID ${itemId}`,
            lineNumber: itemId,
            error: "입고리스트 항목을 찾을 수 없습니다.",
          });
          continue;
        }

        const item = inbound[0];
        const blNo = item.blNo || item.costcoBlNo;

        if (!blNo) {
          results.push({
            input: `Item ID ${itemId}`,
            lineNumber: itemId,
            error: "B/L 번호가 없습니다.",
          });
          continue;
        }

        try {
          // B/L 형식 자동 인식
          let blType = detectBLType(blNo);
          const year = "2025"; // 연도가 없으면 2025로 기본 설정

          // fetchSingleCargo 함수 재사용하여 전체 화물 추적 데이터 가져오기
          let cargoData, rawApiData;
          
          try {
            const result = await fetchSingleCargo(blType, blNo, year);
            cargoData = result.result;
            rawApiData = result.rawApiData;
          } catch (firstAttemptError) {
            // 첫 시도 실패 시 반대 타입으로 재시도
            console.log(`첫 시도 실패 (${blType}), 반대 타입으로 재시도합니다...`);
            blType = blType === 'mbl' ? 'hbl' : 'mbl';
            const result = await fetchSingleCargo(blType, blNo, year);
            cargoData = result.result;
            rawApiData = result.rawApiData;
          }

          // 1. 유니패스 원시 데이터 저장 (unipass_cargo_data 테이블)
          const basicApiInfo = rawApiData?.cargCsclPrgsInfoQryVo || {};
          try {
            await db.insert(unipassCargoData).values({
              inboundListId: item.id,
              cargMtNo: basicApiInfo.cargMtNo,
              mblNo: basicApiInfo.mblNo,
              hblNo: basicApiInfo.hblNo,
              csclPrgsStts: basicApiInfo.csclPrgsStts,
              prgsStts: basicApiInfo.prgsStts,
              prnm: basicApiInfo.prnm,
              pckGcnt: basicApiInfo.pckGcnt,
              pckUt: basicApiInfo.pckUt,
              ttwg: basicApiInfo.ttwg ? String(basicApiInfo.ttwg) : null,
              wghtUt: basicApiInfo.wghtUt,
              msrm: basicApiInfo.msrm ? String(basicApiInfo.msrm) : null,
              shcoFlco: basicApiInfo.shcoFlco,
              cargTp: basicApiInfo.cargTp,
              prcsDttm: basicApiInfo.prcsDttm ? formatDate(basicApiInfo.prcsDttm) : null,
              shipNatNm: basicApiInfo.shipNatNm,
              shipNat: basicApiInfo.shipNat,
              shipNm: basicApiInfo.shipNm,
              blPtNm: basicApiInfo.blPtNm,
              blPt: basicApiInfo.blPt,
              cntrGcnt: basicApiInfo.cntrGcnt,
              cntrNo: basicApiInfo.cntrNo,
              dsprNm: basicApiInfo.dsprNm,
              dsprCd: basicApiInfo.dsprCd,
              etprDt: basicApiInfo.etprDt ? formatDate(basicApiInfo.etprDt) : null,
              ldprNm: basicApiInfo.ldprNm,
              ldprCd: basicApiInfo.ldprCd,
              lodCntyCd: basicApiInfo.lodCntyCd,
              mtTrgtCargYnNm: basicApiInfo.mtTrgtCargYnNm,
              rlseDtyPridPassTpcd: basicApiInfo.rlseDtyPridPassTpcd,
              spcnCargCd: basicApiInfo.spcnCargCd,
              agnc: basicApiInfo.agnc,
              etprCstm: basicApiInfo.etprCstm,
              vydf: basicApiInfo.vydf,
              dclrDelyAdtxYn: basicApiInfo.dclrDelyAdtxYn,
              frwrEntsConm: basicApiInfo.frwrEntsConm,
              rawPayload: rawApiData,
              apiSource: "API019",
            });
            console.log(`Saved Unipass data for item ${itemId}`);
          } catch (dbError) {
            console.error(`Failed to save Unipass data for item ${itemId}:`, dbError);
          }

          // 2. 화물표 데이터 병합 (Unipass + 입고리스트)
          const manifestData = {
            // 1-11: 기본 정보
            품명: item.description || "-",
            수량: cargoData.basicInfo.pkgCount || item.mpk || "-",
            중량: cargoData.basicInfo.totalWeight || "-",
            입항일자: cargoData.arrivalReport?.approvalDateTime || cargoData.basicInfo?.unloadingDate || "-",
            contNo: item.containerCntrNo || (cargoData.containers && cargoData.containers.length > 0 
              ? cargoData.containers[0].containerNo 
              : "-"),
            화물종류: cargoData.basicInfo.cargoType === "F" ? "FCL" 
              : cargoData.basicInfo.cargoType === "L" ? "LCL" 
              : cargoData.basicInfo.cargoType || "-",
            dryWet: item.구분 || "-",
            수출국명: formatExportCountry(cargoData.basicInfo.loadingPort || ""),
            선명: cargoData.basicInfo.shipName || "-",
            검역사항: "검역완료 □",
            경유지: "-",
            // 12-14: 중요 정보
            blNo: item.blNo || "-",
            화물관리번호: cargoData.basicInfo.cargoId || "-",
            수입자: item.수입자 || "-",
            // 15-26: 상세 정보 (입고리스트)
            반입일자: excelDateToString(item.반입일자),
            palletQty: item.palletQty || "-",
            plt: item.plt || "-",
            매수: item.매수 || "-",
            bl수량: item.qty || "-",
            tie: item.tie || "-",
            sellUnitPerCase: item.unit || "-",
            do: item.dept ? `D${item.dept}` : "-",
            itemNo: item.itemNo ? `#${item.itemNo}` : "-",
            수량Pcs: item.mpk || "-",
            높이: item.높이 || "-",
            소비기한: item.도착예정Time || "-",
            특이사항: item.비고 || "-",
            costcoBlNo: item.costcoBlNo || "-",
            // 유니패스 API 추가 필드 (양식 편집기에서 사용 가능)
            mblNo: basicApiInfo.mblNo || "-",
            hblNo: basicApiInfo.hblNo || "-",
            csclPrgsStts: basicApiInfo.csclPrgsStts || "-",
            prgsStts: basicApiInfo.prgsStts || "-",
            prcsDttm: basicApiInfo.prcsDttm ? formatDate(basicApiInfo.prcsDttm) : "-",
            prnm: basicApiInfo.prnm || "-",
            pckGcnt: basicApiInfo.pckGcnt ? String(basicApiInfo.pckGcnt) : "-",
            pckUt: basicApiInfo.pckUt || "-",
            ttwg: basicApiInfo.ttwg ? String(basicApiInfo.ttwg) : "-",
            wghtUt: basicApiInfo.wghtUt || "-",
            msrm: basicApiInfo.msrm ? String(basicApiInfo.msrm) : "-",
            cargTp: basicApiInfo.cargTp || "-",
            shipNm: basicApiInfo.shipNm || "-",
            shipNatNm: basicApiInfo.shipNatNm || "-",
            shipNat: basicApiInfo.shipNat || "-",
            shcoFlco: basicApiInfo.shcoFlco || "-",
            agnc: basicApiInfo.agnc || "-",
            vydf: basicApiInfo.vydf || "-",
            etprDt: basicApiInfo.etprDt ? formatDate(basicApiInfo.etprDt) : "-",
            etprCstm: basicApiInfo.etprCstm || "-",
            ldprNm: basicApiInfo.ldprNm || "-",
            ldprCd: basicApiInfo.ldprCd || "-",
            dsprNm: basicApiInfo.dsprNm || "-",
            dsprCd: basicApiInfo.dsprCd || "-",
            lodCntyCd: basicApiInfo.lodCntyCd || "-",
            cntrGcnt: basicApiInfo.cntrGcnt ? String(basicApiInfo.cntrGcnt) : "-",
            cntrNo: basicApiInfo.cntrNo || "-",
            blPtNm: basicApiInfo.blPtNm || "-",
            blPt: basicApiInfo.blPt || "-",
            spcnCargCd: basicApiInfo.spcnCargCd || "-",
            mtTrgtCargYnNm: basicApiInfo.mtTrgtCargYnNm || "-",
            rlseDtyPridPassTpcd: basicApiInfo.rlseDtyPridPassTpcd || "-",
            dclrDelyAdtxYn: basicApiInfo.dclrDelyAdtxYn || "-",
            frwrEntsConm: basicApiInfo.frwrEntsConm || "-",
          };

          // 3. manifest_results 테이블에 저장
          try {
            await db.insert(manifestResults).values({
              inboundListId: item.id,
              ...manifestData,
              sourceApi: "API019,API020,API021,API024",
            });
          } catch (dbError) {
            console.error(`Failed to save manifest for item ${itemId}:`, dbError);
          }

          results.push({
            input: `${blNo} (Item No: ${item.itemNo || '-'})`,
            lineNumber: itemId,
            result: cargoData,
            manifest: manifestData,
          });
        } catch (apiError) {
          console.error(`Unipass API error for item ${itemId}:`, apiError);
          
          // API 오류 시에도 입고리스트 데이터로 화물표 생성
          const fallbackManifest = {
            품명: item.description || "-",
            수량: item.mpk || "-",
            중량: "-",
            입항일자: "-",
            contNo: item.containerCntrNo || "-",
            화물종류: "-",
            dryWet: item.구분 || "-",
            수출국명: "-",
            선명: "-",
            검역사항: "검역완료 □",
            경유지: "-",
            blNo: item.blNo || "-",
            화물관리번호: "-",
            수입자: item.수입자 || "-",
            반입일자: excelDateToString(item.반입일자),
            palletQty: item.palletQty || "-",
            plt: item.plt || "-",
            매수: item.매수 || "-",
            bl수량: item.qty || "-",
            tie: item.tie || "-",
            sellUnitPerCase: item.unit || "-",
            do: item.dept ? `D${item.dept}` : "-",
            itemNo: item.itemNo ? `#${item.itemNo}` : "-",
            수량Pcs: item.mpk || "-",
            높이: item.높이 || "-",
            소비기한: item.도착예정Time || "-",
            특이사항: item.비고 || "-",
            costcoBlNo: item.costcoBlNo || "-",
            // 유니패스 API 추가 필드 (API 실패 시 빈 값)
            mblNo: "-",
            hblNo: "-",
            csclPrgsStts: "-",
            prgsStts: "-",
            prcsDttm: "-",
            prnm: "-",
            pckGcnt: "-",
            pckUt: "-",
            ttwg: "-",
            wghtUt: "-",
            msrm: "-",
            cargTp: "-",
            shipNm: "-",
            shipNatNm: "-",
            shipNat: "-",
            shcoFlco: "-",
            agnc: "-",
            vydf: "-",
            etprDt: "-",
            etprCstm: "-",
            ldprNm: "-",
            ldprCd: "-",
            dsprNm: "-",
            dsprCd: "-",
            lodCntyCd: "-",
            cntrGcnt: "-",
            cntrNo: "-",
            blPtNm: "-",
            blPt: "-",
            spcnCargCd: "-",
            mtTrgtCargYnNm: "-",
            rlseDtyPridPassTpcd: "-",
            dclrDelyAdtxYn: "-",
            frwrEntsConm: "-",
          };

          // API 오류 시에도 입고리스트 데이터로 manifest_results 저장
          try {
            await db.insert(manifestResults).values({
              inboundListId: item.id,
              ...fallbackManifest,
              sourceApi: "FALLBACK",
            });
          } catch (dbError) {
            console.error(`Failed to save fallback manifest for item ${itemId}:`, dbError);
          }

          results.push({
            input: `${blNo} (Item No: ${item.itemNo || '-'})`,
            lineNumber: itemId,
            error: apiError instanceof Error ? apiError.message : "화물 조회 중 오류가 발생했습니다.",
            manifest: fallbackManifest,
          });
        }
      }

      res.json(results);
    } catch (error) {
      console.error("Batch manifest generation error:", error);
      res.status(500).json({ 
        error: "화물 데이터 생성 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 양식 템플릿 API
  
  // 모든 양식 조회 (모든 사용자 읽기 가능)
  app.get("/api/form-templates", requireAuth, async (req, res) => {
    try {
      // 캐시 방지 헤더 설정 (템플릿 수정 시 즉시 반영)
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      // 모든 템플릿 조회 (관리자가 관리하는 시스템 공용 템플릿)
      const templates = await db.select().from(formTemplates)
        .orderBy(desc(formTemplates.isDefault), desc(formTemplates.createdAt));
      res.json(templates);
    } catch (error) {
      console.error("Error fetching form templates:", error);
      res.status(500).json({ 
        error: "양식 목록을 불러오는 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 특정 양식 조회 (모든 사용자 읽기 가능)
  app.get("/api/form-templates/:id", requireAuth, async (req, res) => {
    try {
      // 캐시 방지 헤더 설정 (템플릿 수정 시 즉시 반영)
      res.set('Cache-Control', 'no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID입니다." });
      }

      const template = await db.select().from(formTemplates)
        .where(eq(formTemplates.id, id))
        .limit(1);
      
      if (template.length === 0) {
        return res.status(404).json({ error: "양식을 찾을 수 없습니다." });
      }

      res.json(template[0]);
    } catch (error) {
      console.error("Error fetching form template:", error);
      res.status(500).json({ 
        error: "양식을 불러오는 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 양식 생성 (관리자만)
  app.post("/api/form-templates", requireAdmin, async (req, res) => {
    try {
      const validated = insertFormTemplateSchema.parse(req.body);
      
      const newTemplate = await db.insert(formTemplates).values(validated).returning();
      
      res.status(201).json(newTemplate[0]);
    } catch (error) {
      console.error("Error creating form template:", error);
      res.status(400).json({ 
        error: "양식 생성 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });


  // 양식 수정 (관리자만)
  app.put("/api/form-templates/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID입니다." });
      }

      // 양식 존재 확인
      const existing = await db.select().from(formTemplates)
        .where(eq(formTemplates.id, id))
        .limit(1);
      
      if (!existing.length) {
        return res.status(404).json({ error: "양식을 찾을 수 없습니다." });
      }

      // 양식 수정 (updatedAt 자동 갱신)
      const validated = insertFormTemplateSchema.parse(req.body);
      
      const updated = await db
        .update(formTemplates)
        .set({
          ...validated,
          updatedAt: new Date(), // 수정 시각 자동 갱신
        })
        .where(eq(formTemplates.id, id))
        .returning();

      res.json(updated[0]);
    } catch (error) {
      console.error("Error updating form template:", error);
      res.status(400).json({ 
        error: "양식 수정 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 양식 삭제 (관리자만)
  app.delete("/api/form-templates/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID입니다." });
      }

      // 전체 양식 개수 확인 - 최소 1개는 유지
      const allTemplates = await db.select().from(formTemplates);
      
      if (allTemplates.length <= 1) {
        return res.status(400).json({ error: "최소 1개의 양식은 유지되어야 합니다. 마지막 양식은 삭제할 수 없습니다." });
      }

      // 삭제
      const deleted = await db
        .delete(formTemplates)
        .where(eq(formTemplates.id, id))
        .returning();

      if (deleted.length === 0) {
        return res.status(404).json({ error: "양식을 찾을 수 없습니다." });
      }

      res.json({ success: true, deleted: deleted[0] });
    } catch (error) {
      console.error("Error deleting form template:", error);
      res.status(500).json({ 
        error: "양식 삭제 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 기본 양식으로 설정 (관리자만)
  app.post("/api/form-templates/:id/set-default", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "잘못된 ID입니다." });
      }

      // 선택된 양식 존재 확인
      const template = await db.select().from(formTemplates)
        .where(eq(formTemplates.id, id))
        .limit(1);
      
      if (template.length === 0) {
        return res.status(404).json({ error: "양식을 찾을 수 없습니다." });
      }

      // 모든 양식의 isDefault를 0으로 설정 (시스템 전체 기본 양식은 1개만)
      await db.update(formTemplates).set({ isDefault: 0 });

      // 선택된 양식만 isDefault를 1로 설정
      const updated = await db
        .update(formTemplates)
        .set({ isDefault: 1 })
        .where(eq(formTemplates.id, id))
        .returning();

      res.json({ success: true, template: updated[0] });
    } catch (error) {
      console.error("Error setting default template:", error);
      res.status(500).json({ 
        error: "기본 양식 설정 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // 기본 화물표 템플릿 생성 (관리자만)
  app.post("/api/form-templates/create-default", requireAdmin, async (req, res) => {
    try {
      const defaultTemplate = {
        name: "기본 화물표 양식",
        structure: {
          rows: 30,
          cols: 4,
          cells: [
            // 제목
            { row: 0, col: 0, value: "수입화물[검역]표", rowSpan: 1, colSpan: 4, style: { fontSize: 18, fontWeight: "bold", color: "#000000" }, field: null },
            // 품명
            { row: 1, col: 0, value: "품명", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 1, col: 1, value: "", rowSpan: 1, colSpan: 3, style: { fontSize: 18, fontWeight: "normal", color: "#000000" }, field: "품명" },
            // 수량/중량
            { row: 2, col: 0, value: "수량 / 중량", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 2, col: 1, value: "", rowSpan: 1, colSpan: 1, style: { fontSize: 22, fontWeight: "bold", color: "#000000" }, field: "수량" },
            { row: 2, col: 2, value: "", rowSpan: 1, colSpan: 2, style: { fontSize: 22, fontWeight: "bold", color: "#000000" }, field: "중량" },
            // 입항일자
            { row: 3, col: 0, value: "입항일자", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 3, col: 1, value: "", rowSpan: 1, colSpan: 2, style: { fontSize: 18, fontWeight: "normal", color: "#000000" }, field: "입항일자" },
            { row: 3, col: 3, value: "", rowSpan: 3, colSpan: 1, style: { fontSize: 60, fontWeight: "bold", color: "#000000" }, field: "dryWet" },
            // CONT No.
            { row: 4, col: 0, value: "CONT No.", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 4, col: 1, value: "", rowSpan: 1, colSpan: 2, style: { fontSize: 18, fontWeight: "normal", color: "#000000" }, field: "contNo" },
            // 화물종류
            { row: 5, col: 0, value: "화물종류", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 5, col: 1, value: "", rowSpan: 1, colSpan: 2, style: { fontSize: 18, fontWeight: "normal", color: "#000000" }, field: "화물종류" },
            // 수출국명/선명
            { row: 6, col: 0, value: "수출국명", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 6, col: 1, value: "", rowSpan: 1, colSpan: 1, style: { fontSize: 18, fontWeight: "normal", color: "#000000" }, field: "수출국명" },
            { row: 6, col: 2, value: "선명", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 6, col: 3, value: "", rowSpan: 1, colSpan: 1, style: { fontSize: 18, fontWeight: "normal", color: "#000000" }, field: "선명" },
            // 검역사항/경유지
            { row: 7, col: 0, value: "검역사항", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 7, col: 1, value: "", rowSpan: 1, colSpan: 1, style: { fontSize: 18, fontWeight: "normal", color: "#000000" }, field: "검역사항" },
            { row: 7, col: 2, value: "경유지", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 7, col: 3, value: "", rowSpan: 1, colSpan: 1, style: { fontSize: 18, fontWeight: "normal", color: "#000000" }, field: "경유지" },
            // B/L No.
            { row: 8, col: 0, value: "B/L No.", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 8, col: 1, value: "", rowSpan: 1, colSpan: 3, style: { fontSize: 40, fontWeight: "bold", color: "#000000" }, field: "blNo" },
            // 화물관리번호
            { row: 9, col: 0, value: "화물관리번호", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 9, col: 1, value: "", rowSpan: 1, colSpan: 3, style: { fontSize: 30, fontWeight: "bold", color: "#000000" }, field: "화물관리번호" },
            // 수입자
            { row: 10, col: 0, value: "수입자", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 10, col: 1, value: "", rowSpan: 1, colSpan: 3, style: { fontSize: 20, fontWeight: "bold", color: "#000000" }, field: "수입자" },
            // Costco B/L No. (큰 셀)
            { row: 11, col: 0, value: "", rowSpan: 1, colSpan: 4, style: { fontSize: 90, fontWeight: "bold", color: "#000000" }, field: "costcoBlNo" },
            // 반입일자
            { row: 12, col: 0, value: "반입일자", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 12, col: 1, value: "", rowSpan: 1, colSpan: 3, style: { fontSize: 30, fontWeight: "bold", color: "#000000" }, field: "반입일자" },
            // PLT/B/L수량
            { row: 13, col: 0, value: "PLT", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 13, col: 1, value: "", rowSpan: 1, colSpan: 1, style: { fontSize: 30, fontWeight: "bold", color: "#000000" }, field: "plt" },
            { row: 13, col: 2, value: "B/L수량", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 13, col: 3, value: "", rowSpan: 1, colSpan: 1, style: { fontSize: 22, fontWeight: "bold", color: "#000000" }, field: "bl수량" },
            // TIE/SELL UNIT
            { row: 14, col: 0, value: "TIE", rowSpan: 1, colSpan: 2, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 14, col: 2, value: "SELL UNIT PER CASE", rowSpan: 1, colSpan: 2, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 15, col: 0, value: "", rowSpan: 1, colSpan: 1, style: { fontSize: 22, fontWeight: "bold", color: "#000000" }, field: "tie" },
            { row: 15, col: 1, value: "BOX", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 15, col: 2, value: "", rowSpan: 1, colSpan: 1, style: { fontSize: 22, fontWeight: "bold", color: "#000000" }, field: "sellUnitPerCase" },
            { row: 15, col: 3, value: "EA", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            // PALLET 적재정보 제목
            { row: 16, col: 0, value: "PALLET 적재정보", rowSpan: 1, colSpan: 4, style: { fontSize: 18, fontWeight: "bold", color: "#000000" }, field: null },
            // DO/itemNo (큰 셀)
            { row: 17, col: 0, value: "", rowSpan: 1, colSpan: 2, style: { fontSize: 60, fontWeight: "bold", color: "#000000" }, field: "do" },
            { row: 17, col: 2, value: "", rowSpan: 1, colSpan: 2, style: { fontSize: 60, fontWeight: "bold", color: "#000000" }, field: "itemNo" },
            // 수량(PCS)/높이
            { row: 18, col: 0, value: "수량(PCS)", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 18, col: 1, value: "", rowSpan: 1, colSpan: 1, style: { fontSize: 30, fontWeight: "bold", color: "#000000" }, field: "수량Pcs" },
            { row: 18, col: 2, value: "높이", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 18, col: 3, value: "", rowSpan: 1, colSpan: 1, style: { fontSize: 30, fontWeight: "bold", color: "#000000" }, field: "높이" },
            // 소비기한
            { row: 19, col: 0, value: "소비기한", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 19, col: 1, value: "", rowSpan: 1, colSpan: 3, style: { fontSize: 22, fontWeight: "bold", color: "#000000" }, field: "소비기한" },
            // 특이사항
            { row: 20, col: 0, value: "특이사항", rowSpan: 1, colSpan: 1, style: { fontSize: 14, fontWeight: "bold", color: "#000000" }, field: null },
            { row: 20, col: 1, value: "", rowSpan: 1, colSpan: 3, style: { fontSize: 20, fontWeight: "bold", color: "#dc2626" }, field: "특이사항" },
          ]
        }
      };

      const newTemplate = await db.insert(formTemplates).values(defaultTemplate).returning();
      
      res.status(201).json(newTemplate[0]);
    } catch (error) {
      console.error("Error creating default template:", error);
      res.status(500).json({ 
        error: "기본 템플릿 생성 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // ===== 일괄 인쇄 PDF 생성 API =====

  // Job 생성
  app.post("/api/batch-print/pdf", async (req, res) => {
    try {
      const { manifestData } = createBatchPrintJobRequestSchema.parse(req.body);
      
      const job = pdfService.createJob(manifestData);
      
      // 비동기로 PDF 생성 시작
      pdfService.generatePDF(job.id).catch(error => {
        console.error(`PDF generation failed for job ${job.id}:`, error);
      });
      
      res.json(job);
    } catch (error) {
      console.error("Error creating batch print job:", error);
      res.status(500).json({ 
        error: "일괄 인쇄 작업 생성 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Job 상태 조회
  app.get("/api/batch-print/jobs/:id", (req, res) => {
    try {
      const job = pdfService.getJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ error: "작업을 찾을 수 없습니다." });
      }
      
      res.json(job);
    } catch (error) {
      console.error("Error getting batch print job:", error);
      res.status(500).json({ 
        error: "작업 조회 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // PDF 다운로드
  app.get("/api/batch-print/jobs/:id/download", (req, res) => {
    try {
      const job = pdfService.getJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ error: "작업을 찾을 수 없습니다." });
      }
      
      if (job.status !== "completed" || !job.pdfPath) {
        return res.status(400).json({ error: "PDF가 아직 생성되지 않았습니다." });
      }
      
      // PDF 파일 전송
      res.download(job.pdfPath, `batch-print-${job.id}.pdf`, (err) => {
        if (err) {
          console.error("Error downloading PDF:", err);
          res.status(500).json({ error: "PDF 다운로드 중 오류가 발생했습니다." });
        }
      });
    } catch (error) {
      console.error("Error downloading PDF:", error);
      res.status(500).json({ 
        error: "PDF 다운로드 중 오류가 발생했습니다.",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
