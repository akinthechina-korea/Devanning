/**
 * ScaledManifest Wrapper 컴포넌트
 * 
 * CSS transform: scale()을 사용하여 화물표 전체(이미지 + 필드)를
 * 하나의 단위로 스케일링합니다.
 * 
 * 5개 컨텍스트에서 공통으로 사용:
 * - 화물표 미리보기 (preview)
 * - 인쇄/PDF 저장 (print)
 * - 일괄인쇄 (batch)
 * - HTML 다운로드 (html)
 * - 양식 편집기 (editor) - 편집 모드가 아닐 때만
 */

import { createContext, useContext, CSSProperties } from "react";

/**
 * Scale Context: 하위 컴포넌트에서 현재 scale 값을 사용할 수 있도록 제공
 */
interface ScaleContextValue {
  scaleX: number;
  scaleY: number;
}

const ScaleContext = createContext<ScaleContextValue | null>(null);

/**
 * useScale Hook: 현재 scale 값 가져오기
 * 
 * 편집 모드에서 마우스 좌표 보정시 사용:
 * - normalizeMouseCoordinate(clientX, offsetX, scaleX)
 * - normalizeMouseDelta(deltaX, scaleX)
 */
export function useScale(): { scaleX: number; scaleY: number } {
  const context = useContext(ScaleContext);
  if (!context) {
    // ScaledManifest 밖에서 사용되면 기본값 1.0 반환
    return { scaleX: 1.0, scaleY: 1.0 };
  }
  return context;
}

/**
 * ScaledManifest Props
 */
interface ScaledManifestProps {
  /** 가로 scale 배율 (computeScaleForA4로 계산) */
  scaleX: number;
  
  /** 세로 scale 배율 (computeScaleForA4로 계산) */
  scaleY: number;
  
  /** 원본 템플릿 너비 (px) */
  baseWidthPx: number;
  
  /** 원본 템플릿 높이 (px) */
  baseHeightPx: number;
  
  /** 스케일링할 화물표 내용 */
  children: React.ReactNode;
  
  /** 추가 className (외부 wrapper에 적용) */
  className?: string;
  
  /** 추가 style (외부 wrapper에 적용) */
  style?: CSSProperties;
}

/**
 * ScaledManifest 컴포넌트
 * 
 * transform: scale(scaleX, scaleY)을 사용하여 children을 스케일링합니다.
 * 
 * 구조:
 * ```
 * <div style={{ width: baseWidth * scaleX, height: baseHeight * scaleY }}>
 *   <div style={{ transform: scale(scaleX, scaleY), transformOrigin: top left, width: baseWidth, height: baseHeight }}>
 *     {children}
 *   </div>
 * </div>
 * ```
 * 
 * 외부 div는 scale 적용 후 실제 차지하는 공간을 정의합니다.
 * 내부 div는 원본 크기로 렌더링되며 transform으로만 스케일됩니다.
 */
export function ScaledManifest({
  scaleX,
  scaleY,
  baseWidthPx,
  baseHeightPx,
  children,
  className = "",
  style = {},
}: ScaledManifestProps) {
  // Scale 적용 후 실제 차지하는 공간 계산
  const scaledWidth = baseWidthPx * scaleX;
  const scaledHeight = baseHeightPx * scaleY;

  return (
    <ScaleContext.Provider value={{ scaleX, scaleY }}>
      {/* 외부 wrapper: scale 적용 후 실제 차지하는 공간 */}
      <div
        className={className}
        style={{
          width: scaledWidth,
          height: scaledHeight,
          position: 'relative',
          ...style,
        }}
      >
        {/* 내부 wrapper: 원본 크기 + transform scale */}
        <div
          style={{
            width: baseWidthPx,
            height: baseHeightPx,
            transform: `scale(${scaleX}, ${scaleY})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </ScaleContext.Provider>
  );
}
