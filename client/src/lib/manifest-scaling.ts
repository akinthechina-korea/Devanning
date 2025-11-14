/**
 * A4 스케일링 시스템
 * 
 * CSS transform: scale()을 사용하여 화물표 전체(이미지 + 필드)를 하나의 단위로 스케일링합니다.
 * 레이아웃 dimensions은 변경하지 않으므로 편집 기능(드래그/리사이즈)이 정상 작동합니다.
 * 
 * 5개 컨텍스트에서 동일한 크기 보장:
 * 1. 화물표 미리보기
 * 2. 인쇄/PDF 저장
 * 3. 일괄인쇄
 * 4. HTML 다운로드
 * 5. 양식 생성/편집
 */

import type { TemplateStructure } from "@shared/schema";
import { CSSProperties } from "react";

// A4 용지 크기 (96 DPI 기준: 1 inch = 96 pixels)
// A4: 210mm × 297mm = 8.27 × 11.69 inches
const A4_WIDTH_PX = 210 * (96 / 25.4);   // 793.7px
const A4_HEIGHT_PX = 297 * (96 / 25.4);  // 1122.5px

// 여백 완전히 제거 (비율 무시하고 A4 용지 완전히 채우기)
const MARGIN_TOP_BOTTOM_MM = 0;    // 상하 0mm
const MARGIN_LEFT_RIGHT_MM = 0;    // 좌우 0mm
const MARGIN_TB_PX = MARGIN_TOP_BOTTOM_MM * (96 / 25.4); // 0px
const MARGIN_LR_PX = MARGIN_LEFT_RIGHT_MM * (96 / 25.4); // 0px

// A4 사용 가능 영역 (여백 제외) = A4 전체
const A4_USABLE_WIDTH = A4_WIDTH_PX - (MARGIN_LR_PX * 2);   // 793.7px (A4 전체 너비!)
const A4_USABLE_HEIGHT = A4_HEIGHT_PX - (MARGIN_TB_PX * 2); // 1122.5px (A4 전체 높이!)

/**
 * 타겟 모드별 컨테이너 설정
 */
export type TargetMode = 
  | 'preview'      // 화면 미리보기
  | 'print'        // 인쇄/PDF
  | 'batch'        // 일괄인쇄
  | 'html'         // HTML 다운로드
  | 'editor';      // 편집기

/**
 * 템플릿의 기본 픽셀 dimensions 반환
 */
export interface BaseDimensions {
  widthPx: number;
  heightPx: number;
}

export function computeBaseDimensions(structure: TemplateStructure): BaseDimensions {
  return {
    widthPx: structure.imageWidth,
    heightPx: structure.imageHeight,
  };
}

/**
 * A4 최적 scale 계산
 * 
 * 화물표가 A4 용지에 최대한 크게 표시되도록 scale을 계산합니다.
 * width와 height 중 제약이 더 큰 쪽에 맞춥니다.
 * 
 * 인쇄 모드에서는 확대(upscale)를 허용하여 A4를 최대 활용합니다.
 * 화면 모드에서는 1.0으로 제한하여 너무 커지지 않게 합니다.
 */
export interface ScaleOptions {
  baseWidthPx: number;
  baseHeightPx: number;
  targetMode: TargetMode;
  maxScreenWidth?: number;    // 화면 모드에서 최대 너비 제한
  maxScreenHeight?: number;   // 화면 모드에서 최대 높이 제한
  maxUpscaleFactor?: number;  // 최대 확대 배율 (기본: 2.0)
}

export interface ScaleResult {
  scaleX: number;
  scaleY: number;
}

export function computeScaleForA4(options: ScaleOptions): ScaleResult {
  const { 
    baseWidthPx, 
    baseHeightPx, 
    targetMode, 
    maxScreenWidth,
    maxScreenHeight,
    maxUpscaleFactor = 6.0  // 6.0으로 증가 (상하 완전히 끝까지!)
  } = options;

  // 인쇄/PDF/일괄인쇄/HTML 모드: A4 용지를 상하좌우 최대한 채우기 (비율 무시)
  if (targetMode === 'print' || targetMode === 'batch' || targetMode === 'html') {
    let scaleX = A4_USABLE_WIDTH / baseWidthPx;
    let scaleY = A4_USABLE_HEIGHT / baseHeightPx;
    
    // 최대 확대 배율로 제한 (품질 보호)
    scaleX = Math.min(scaleX, maxUpscaleFactor);
    scaleY = Math.min(scaleY, maxUpscaleFactor);
    
    // 최소 0.3으로 제한 (너무 작아지지 않게)
    scaleX = Math.max(scaleX, 0.3);
    scaleY = Math.max(scaleY, 0.3);
    
    return { scaleX, scaleY };
  }

  // 화면 미리보기/편집기 모드: 비율 유지 (확대 안함)
  if (targetMode === 'preview' || targetMode === 'editor') {
    // 기본적으로 A4 scale 사용 (비율 유지)
    const scaleByWidth = A4_USABLE_WIDTH / baseWidthPx;
    const scaleByHeight = A4_USABLE_HEIGHT / baseHeightPx;
    let scale = Math.min(scaleByWidth, scaleByHeight);
    
    // 화면 제약이 있으면 추가 조정
    if (maxScreenWidth) {
      const screenScaleByWidth = maxScreenWidth / baseWidthPx;
      scale = Math.min(scale, screenScaleByWidth);
    }
    if (maxScreenHeight) {
      const screenScaleByHeight = maxScreenHeight / baseHeightPx;
      scale = Math.min(scale, screenScaleByHeight);
    }
    
    // 화면 모드는 최대 1.0으로 제한 (확대 방지)
    scale = Math.min(scale, 1.0);
    
    // 최소 0.3
    scale = Math.max(scale, 0.3);
    
    // 비율 유지: scaleX === scaleY
    return { scaleX: scale, scaleY: scale };
  }

  // 기본값
  return { scaleX: 1.0, scaleY: 1.0 };
}

/**
 * CSS transform scale 스타일 생성
 * 
 * transform: scale()과 transform-origin: top left를 반환합니다.
 * 이렇게 하면 전체 화물표가 하나의 단위로 스케일되며,
 * 내부 레이아웃 dimensions은 변경되지 않습니다.
 */
export function withScaleStyles(scale: number): {
  style: CSSProperties;
  dataScale: number;
} {
  return {
    style: {
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
    },
    dataScale: scale,
  };
}

/**
 * 스케일 적용 후 실제 차지하는 공간 계산
 * 
 * transform: scale()은 layout space를 변경하지 않으므로,
 * 컨테이너가 실제로 차지하는 공간을 계산하려면 원본 크기에 scale을 곱해야 합니다.
 */
export interface ScaledSpace {
  width: number;
  height: number;
}

export function computeScaledSpace(
  baseWidthPx: number,
  baseHeightPx: number,
  scale: number
): ScaledSpace {
  return {
    width: baseWidthPx * scale,
    height: baseHeightPx * scale,
  };
}

/**
 * 편집 모드에서 마우스 좌표를 unscaled coordinate로 변환
 * 
 * 편집 캔버스가 scale wrapper 안에 있을 경우,
 * 마우스 이벤트의 clientX/Y를 scale로 나눠야 정확한 필드 좌표를 얻습니다.
 */
export function normalizeMouseCoordinate(
  clientCoord: number,
  containerOffset: number,
  scale: number
): number {
  return (clientCoord - containerOffset) / scale;
}

/**
 * 편집 모드에서 마우스 delta를 unscaled delta로 변환
 */
export function normalizeMouseDelta(delta: number, scale: number): number {
  return delta / scale;
}
