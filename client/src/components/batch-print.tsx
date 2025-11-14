import { type ManifestData, type FormTemplate, type TemplateStructure, type TemplateField } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { calculateOptimalFontSize } from "@/lib/text-measurement";
import { PresentationalManifest } from "@/components/presentational-manifest";
import { ScaledManifest } from "@/components/scaled-manifest";
import { computeBaseDimensions, computeScaleForA4 } from "@/lib/manifest-scaling";

interface BatchPrintProps {
  results: Array<{ data: ManifestData; template: FormTemplate }>;
  onClose: () => void;
}

// BL 그룹 타입
interface BlGroup {
  blNo: string;
  items: Array<{
    itemNo: string;
    pltQty: number;
    copyCount: number;
    data: ManifestData;
    template: FormTemplate;
  }>;
  totalManifests: number;
  totalPages: number;
}

export function BatchPrint({ results, onClose }: BatchPrintProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // BL별로 그룹핑
  const groupByBl = (): BlGroup[] => {
    const groups = new Map<string, BlGroup>();

    results.forEach(({ data, template }) => {
      const blNo = data.blNo || "UNKNOWN";
      const itemNo = data.itemNo || "UNKNOWN";
      const pltQty = parseInt(data.plt || "0", 10);
      const copyCount = parseInt(data.매수 || "1", 10);

      if (!groups.has(blNo)) {
        groups.set(blNo, {
          blNo,
          items: [],
          totalManifests: 0,
          totalPages: 0,
        });
      }

      const group = groups.get(blNo)!;
      group.items.push({ itemNo, pltQty, copyCount, data, template });
      group.totalManifests++;
      group.totalPages += pltQty * copyCount;
    });

    return Array.from(groups.values()).sort((a, b) => a.blNo.localeCompare(b.blNo));
  };

  const blGroups = groupByBl();
  const totalBls = blGroups.length;
  const totalManifests = blGroups.reduce((sum, g) => sum + g.totalManifests, 0);
  const totalPages = 1 + blGroups.length + blGroups.reduce((sum, g) => sum + g.totalPages, 0) + 1; // 시작 + 구분 + 화물표 + 끝

  // 이미지 URL을 Base64로 변환
  const convertImageToBase64 = async (url: string): Promise<string> => {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // 화물표 HTML 생성 함수 (일괄인쇄 미리보기와 동일한 스케일링 적용)
  const generateManifestHTML = (data: ManifestData, template: FormTemplate): string => {
    const structure = template.structure as TemplateStructure;
    const getFieldValue = (field: string): string => {
      const value = data[field as keyof ManifestData];
      return value != null ? String(value) : "";
    };

    // A4 크기 (96 DPI 기준)
    const A4_WIDTH_PX = 793.7;   // 210mm
    const A4_HEIGHT_PX = 1122.5; // 297mm
    
    // 독립적인 scaleX, scaleY 계산 (비율 무시, A4 전체 채우기)
    let scaleX = A4_WIDTH_PX / structure.imageWidth;
    let scaleY = A4_HEIGHT_PX / structure.imageHeight;
    
    // 최대 확대 6.0배로 제한
    const maxUpscale = 6.0;
    scaleX = Math.min(scaleX, maxUpscale);
    scaleY = Math.min(scaleY, maxUpscale);
    
    // 최소 0.3배로 제한
    scaleX = Math.max(scaleX, 0.3);
    scaleY = Math.max(scaleY, 0.3);
    
    // 스케일 적용 후 실제 차지하는 공간
    const scaledWidth = structure.imageWidth * scaleX;
    const scaledHeight = structure.imageHeight * scaleY;

    const fieldsHTML = (structure.fields as TemplateField[]).map(field => {
      const leftPercent = (field.x / structure.imageWidth) * 100;
      const topPercent = (field.y / structure.imageHeight) * 100;
      const widthPercent = (field.width / structure.imageWidth) * 100;
      const heightPercent = (field.height / structure.imageHeight) * 100;

      // overflow 스타일 처리
      let overflowStyle = '';
      if (field.overflow === "hidden" || field.overflow === "ellipsis") {
        overflowStyle += 'overflow: hidden;';
        if (field.overflow === "ellipsis") {
          overflowStyle += 'text-overflow: ellipsis; white-space: nowrap;';
        }
      }
      
      if (field.maxLines && field.maxLines > 0) {
        overflowStyle += `display: -webkit-box; -webkit-line-clamp: ${field.maxLines}; -webkit-box-orient: vertical; overflow: hidden;`;
      }
      
      if (field.wordWrap) {
        overflowStyle += 'word-wrap: break-word; overflow-wrap: break-word; white-space: normal;';
      }
      
      // 기본값: 줄바꿈 방지
      if (!field.wordWrap && !field.maxLines) {
        overflowStyle += 'white-space: nowrap;';
      }

      // Canvas measureText로 정확한 텍스트 너비 측정
      const textContent = getFieldValue(field.field);
      
      // Canvas measureText API로 정확한 폰트 크기와 스케일 계산
      const sizing = calculateOptimalFontSize(
        textContent,
        field.width,
        field.height,
        field.fontWeight,
        field.stretchHeight || false
      );
      
      const finalFontSize = sizing.fontSize;
      const textScaleX = sizing.scaleX;
      const textScaleY = sizing.scaleY;
      let transformStyle = '';
      
      if (field.stretchHeight) {
        // stretchHeight = true: overflow hidden, transform scale 적용
        overflowStyle += ' overflow: hidden;';
        transformStyle = `transform: scale(${textScaleX}, ${textScaleY}); transform-origin: center;`;
      } else {
        // stretchHeight = false: 비율 유지
        if (!field.wordWrap && !field.maxLines) {
          overflowStyle += ' overflow: visible;';
        }
      }
      
      const baseFontSize = (finalFontSize / structure.imageWidth) * 100;

      return `<div style="
        position: absolute;
        left: ${leftPercent}%;
        top: ${topPercent}%;
        width: ${widthPercent}%;
        height: ${heightPercent}%;
        display: flex;
        align-items: center;
        justify-content: center;
        ${overflowStyle}
      ">
        <div style="
          font-family: 'Inter', 'Noto Sans KR', 'Apple SD Gothic Neo', system-ui, -apple-system, sans-serif;
          font-size: ${baseFontSize}cqw;
          color: ${field.color};
          font-weight: ${field.fontWeight};
          line-height: 1;
          white-space: nowrap;
          ${transformStyle}
        ">${textContent}</div>
      </div>`;
    }).join('');

    // ScaledManifest와 동일한 구조: 외부 wrapper(scaled 공간) + 내부 wrapper(원본 크기 + transform)
    return `
      <div style="background: white; height: 100%; width: 100%; display: flex; align-items: center; justify-content: center;">
        <div style="width: ${scaledWidth}px; height: ${scaledHeight}px; position: relative;">
          <div style="width: ${structure.imageWidth}px; height: ${structure.imageHeight}px; transform: scale(${scaleX}, ${scaleY}); transform-origin: top left; position: relative; container-type: inline-size;">
            <div style="position: absolute; inset: 0;">
              <img src="${structure.templateImage}" alt="${template.name}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none;" />
              ${fieldsHTML}
            </div>
          </div>
        </div>
      </div>
    `;
  };

  // HTML 파일 다운로드
  const handleDownloadHTML = async () => {
    try {
      toast({
        title: "HTML 파일 생성 중...",
        description: "이미지를 변환하고 있습니다.",
      });

      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
      const dateStrKo = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const timeStrKo = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      // 모든 템플릿 이미지를 base64로 변환
      const uniqueImages = new Set<string>();
      results.forEach(({ template }) => {
        const structure = template.structure as TemplateStructure;
        uniqueImages.add(structure.templateImage);
      });
      
      const imageMap = new Map<string, string>();
      for (const imgUrl of Array.from(uniqueImages)) {
        try {
          const base64 = await convertImageToBase64(imgUrl);
          imageMap.set(imgUrl, base64);
        } catch (err) {
          console.error('Failed to convert image:', imgUrl, err);
        }
      }
      
      // 페이지들 HTML 생성
      let pagesHTML = '';
      
      // 시작 페이지 (StartPage 컴포넌트와 완전히 동일하게)
      const blListHTML = blGroups.map((group, idx) => {
        const itemsText = group.items.map((item, i) => 
          `${i > 0 ? ' + ' : ''}PLT ${item.pltQty} × ${item.copyCount}`
        ).join('');
        return `<p style="margin: 4px 0;">${idx + 1}. ${group.blNo} (${group.totalManifests}건, ${itemsText} = ${group.totalPages}장)</p>`;
      }).join('');
      
      pagesHTML += `
        <div class="batch-print-page">
          <div style="background: white; padding: 48px; height: 100%; width: 100%;">
            <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; text-align: center;">
              <div style="border-top: 4px solid #1e293b; border-bottom: 4px solid #1e293b; padding: 16px 0; margin-bottom: 32px;">
                <h1 style="font-size: 36px; font-weight: bold; margin: 0;">수입화물검역표 일괄 인쇄 시작</h1>
              </div>
              
              <div style="margin-bottom: 32px;">
                <p style="font-size: 18px; margin: 8px 0;">인쇄 날짜: ${dateStrKo} ${timeStrKo}</p>
              </div>
              
              <div style="margin-bottom: 32px;">
                <p style="font-size: 20px; font-weight: 600; margin: 8px 0;">총 BL 개수: ${totalBls}개</p>
                <p style="font-size: 20px; font-weight: 600; margin: 8px 0;">총 화물표 개수: ${totalManifests}개</p>
                <p style="font-size: 20px; font-weight: 600; margin: 8px 0;">총 인쇄 페이지: ${totalPages.toLocaleString()}장</p>
              </div>
              
              <div style="margin-bottom: 32px;">
                <p style="font-size: 14px; color: #64748b; margin: 4px 0;">- 시작 페이지: 1장</p>
                <p style="font-size: 14px; color: #64748b; margin: 4px 0;">- 구분 페이지: ${totalBls}장</p>
                <p style="font-size: 14px; color: #64748b; margin: 4px 0;">- 화물표: ${(totalPages - totalBls - 2).toLocaleString()}장</p>
                <p style="font-size: 14px; color: #64748b; margin: 4px 0;">- 끝 페이지: 1장</p>
              </div>
              
              <div style="border-top: 2px solid #475569; border-bottom: 2px solid #475569; padding: 24px 0; margin-top: 32px;">
                <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">BL 목록:</h2>
                <div style="text-align: left; max-width: 48rem; margin: 0 auto; font-size: 14px;">
                  ${blListHTML}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // BL별 페이지들 (SeparatorPage 컴포넌트와 완전히 동일하게)
      blGroups.forEach(group => {
        // 구분 페이지
        const itemListHTML = group.items.map((item, idx) => 
          `<p style="font-size: 18px; margin: 8px 0;">${idx + 1}. ${item.itemNo} (PLT ${item.pltQty} × ${item.copyCount} = ${item.pltQty * item.copyCount}장)</p>`
        ).join('');
        
        pagesHTML += `
          <div class="batch-print-page">
            <div style="background: white; padding: 48px; height: 100%; width: 100%;">
              <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; text-align: center;">
                <div style="border-top: 4px solid #1e293b; border-bottom: 4px solid #1e293b; padding: 16px 0; margin-bottom: 32px;">
                  <h1 style="font-size: 36px; font-weight: bold; margin: 0;">BL ${group.blNo}</h1>
                </div>
                
                <div style="margin-bottom: 32px;">
                  <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Item 목록:</h2>
                  <div>
                    ${itemListHTML}
                  </div>
                </div>
                
                <div style="margin-top: 32px;">
                  <p style="font-size: 20px; font-weight: 600; margin: 8px 0;">총 화물표: ${group.totalManifests}개</p>
                  <p style="font-size: 20px; font-weight: 600; margin: 8px 0;">총 인쇄 페이지: ${group.totalPages}장</p>
                </div>
              </div>
            </div>
          </div>
        `;
        
        // 화물표들
        group.items.forEach(item => {
          const copies = item.pltQty * item.copyCount;
          const template = { ...item.template };
          const structure = template.structure as TemplateStructure;
          
          // 이미지 URL을 base64로 교체
          if (imageMap.has(structure.templateImage)) {
            structure.templateImage = imageMap.get(structure.templateImage)!;
            template.structure = structure;
          }
          
          const manifestHTML = generateManifestHTML(item.data, template);
          
          for (let i = 0; i < copies; i++) {
            pagesHTML += `<div class="batch-print-page">${manifestHTML}</div>`;
          }
        });
      });
      
      // 끝 페이지 (EndPage 컴포넌트와 완전히 동일하게)
      pagesHTML += `
        <div class="batch-print-page">
          <div style="background: white; padding: 48px; height: 100%; width: 100%;">
            <div style="height: 100%; display: flex; flex-direction: column; justify-content: center; text-align: center;">
              <div style="border-top: 4px solid #1e293b; border-bottom: 4px solid #1e293b; padding: 16px 0; margin-bottom: 32px;">
                <h1 style="font-size: 36px; font-weight: bold; margin: 0;">수입화물검역표 일괄 인쇄 완료</h1>
              </div>
              
              <div style="margin-bottom: 32px;">
                <p style="font-size: 20px; font-weight: 600; margin: 8px 0;">총 BL 개수: ${totalBls}개</p>
                <p style="font-size: 20px; font-weight: 600; margin: 8px 0;">총 화물표 개수: ${totalManifests}개</p>
                <p style="font-size: 20px; font-weight: 600; margin: 8px 0;">총 인쇄 페이지: ${totalPages.toLocaleString()}장</p>
              </div>
              
              <div style="margin-bottom: 32px;">
                <p style="font-size: 18px; margin: 8px 0;">인쇄 완료 시간: ${dateStrKo} ${timeStrKo}</p>
              </div>
              
              <div style="border-top: 4px solid #1e293b; border-bottom: 4px solid #1e293b; padding: 16px 0; margin-top: 48px;">
                <h2 style="font-size: 48px; font-weight: bold; margin: 0;">끝</h2>
              </div>
            </div>
          </div>
        </div>
      `;
      
      const htmlContent = pagesHTML;
      
      // 전체 HTML 생성
      const fullHTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>화물검역표 일괄인쇄 - ${dateStr}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', 'Noto Sans KR', 'Apple SD Gothic Neo', system-ui, -apple-system, sans-serif;
      background: white;
    }
    
    /* 화면 표시용 */
    @media screen {
      .batch-print-page {
        width: 210mm;
        height: 297mm;
        margin: 20px auto;
        background: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        page-break-after: always;
      }
    }
    
    /* 인쇄용 */
    @media print {
      @page {
        size: A4 portrait;
        margin: 0;
      }
      
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }
      
      html, body {
        width: 210mm;
        height: 297mm;
        margin: 0;
        padding: 0;
        background: white;
      }
      
      .batch-print-page {
        display: block;
        position: relative;
        width: 210mm;
        height: 297mm;
        margin: 0;
        padding: 0;
        background: white;
        box-shadow: none;
        page-break-after: always;
        page-break-inside: avoid;
        break-after: page;
        break-inside: avoid;
        overflow: hidden;
      }
      
      .batch-print-page:last-child {
        page-break-after: auto;
        break-after: auto;
      }
    }
    
    /* 화물표 스타일 */
    .manifest-print-area {
      position: relative;
      container-type: inline-size;
    }
    
    .manifest-print-area img {
      pointer-events: none;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

      // Blob 생성 및 다운로드
      const blob = new Blob([fullHTML], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `수입화물검역표_일괄인쇄_${dateStr}_${timeStr}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "HTML 파일 다운로드 완료",
        description: "파일을 열어서 Ctrl+P로 인쇄하세요.",
      });
    } catch (err) {
      console.error("HTML download error:", err);
      toast({
        title: "오류",
        description: "HTML 파일 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col overflow-hidden">
      {/* 상단 버튼 영역 - 인쇄 시 숨김 */}
      <div className="flex-shrink-0 p-4 border-b no-print flex justify-between items-center bg-background">
        <h2 className="text-xl font-semibold">일괄 인쇄 미리보기</h2>
        <div className="flex gap-2 items-center">
          <Button onClick={handleDownloadHTML} data-testid="button-download-html">
            <Download className="mr-2 h-4 w-4" />
            HTML 파일 저장
          </Button>
          <Button variant="outline" onClick={onClose} data-testid="button-close-batch-print">
            <X className="mr-2 h-4 w-4" />
            닫기
          </Button>
        </div>
      </div>

      {/* 스크롤 영역 - 모든 페이지를 스크롤로 미리보기 */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-100" style={{ height: 0 }}>
        <div ref={printRef} id="batch-print-container" className="print:p-0 print:space-y-0 py-8 space-y-6">
          {/* 시작 페이지 */}
          <div className="batch-print-page mx-auto print:shadow-none shadow-lg" style={{ width: '210mm', height: '297mm' }}>
            <StartPage 
              totalBls={totalBls}
              totalManifests={totalManifests}
              totalPages={totalPages}
              blGroups={blGroups}
            />
          </div>

          {/* BL 그룹별 반복 */}
          {blGroups.map((group, groupIdx) => (
            <div key={`group-${groupIdx}`} className="print:space-y-0 space-y-6">
              {/* 구분 페이지 - 한 페이지 */}
              <div className="batch-print-page mx-auto print:shadow-none shadow-lg" style={{ width: '210mm', height: '297mm' }}>
                <SeparatorPage group={group} />
              </div>

              {/* 해당 BL의 화물표들 (각각 PLT × 매수번 반복) - 각각 한 페이지 */}
              {group.items.map((item, itemIdx) => {
                const copies = item.pltQty * item.copyCount;
                return (
                  <div key={`item-${groupIdx}-${itemIdx}`} className="print:space-y-0 space-y-6">
                    {Array.from({ length: copies }).map((_, copyIdx) => (
                      <div key={`manifest-${groupIdx}-${itemIdx}-${copyIdx}`} className="batch-print-page mx-auto print:shadow-none shadow-lg" style={{ width: '210mm', height: '297mm' }}>
                        <ManifestPage
                          data={item.data}
                          template={item.template}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}

          {/* 끝 페이지 */}
          <div className="batch-print-page mx-auto print:shadow-none shadow-lg" style={{ width: '210mm', height: '297mm' }}>
            <EndPage 
              totalBls={totalBls}
              totalManifests={totalManifests}
              totalPages={totalPages}
            />
          </div>
        </div>
      </div>

      {/* 인쇄용 CSS - window.print() 최적화 */}
      <style>{`
        @media print {
          /* A4 페이지 설정 - 여백 최소화 */
          @page {
            size: A4 portrait;
            margin: 0;
          }
          
          /* 전체 문서 초기화 */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          html {
            width: 210mm;
            height: 297mm;
          }
          
          body {
            width: 210mm;
            height: 297mm;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: visible !important;
          }
          
          /* 상단 버튼 영역 완전 제거 */
          .no-print,
          .no-print * {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* 스크롤 영역 초기화 */
          .overflow-y-auto,
          .overflow-x-hidden {
            overflow: visible !important;
            height: auto !important;
          }
          
          /* 컨테이너 초기화 */
          #batch-print-container {
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            height: auto !important;
          }
          
          /* ===== 핵심: 페이지 분리 보장 ===== */
          .batch-print-page {
            display: block !important;
            position: relative !important;
            width: 210mm !important;
            height: 297mm !important;
            min-height: 297mm !important;
            max-height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
            
            /* 배경 */
            background: white !important;
            box-shadow: none !important;
            
            /* 페이지 분리 (중복 적용으로 확실하게) */
            page-break-after: always !important;
            page-break-before: auto !important;
            page-break-inside: avoid !important;
            break-after: page !important;
            break-before: auto !important;
            break-inside: avoid !important;
            
            /* 넘침 방지 */
            overflow: hidden !important;
          }
          
          /* 첫 페이지 */
          .batch-print-page:first-child {
            page-break-before: avoid !important;
            break-before: avoid !important;
          }
          
          /* 마지막 페이지만 break 제거 */
          .batch-print-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          
          /* 중첩된 div 구조 정리 */
          .batch-print-page > div {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* space-y 클래스 무력화 */
          .space-y-6,
          .space-y-0 {
            gap: 0 !important;
          }
          
          .space-y-6 > *,
          .space-y-0 > * {
            margin-top: 0 !important;
            margin-bottom: 0 !important;
          }
          
          /* 필드 배경 투명 처리 */
          .manifest-print-area [style*="background"],
          [style*="background-color"],
          [style*="backgroundColor"] {
            background: transparent !important;
            background-color: transparent !important;
            background-image: none !important;
          }
          
          /* 테두리 유지 */
          [style*="border"] {
            border-color: #000 !important;
          }
        }
      `}</style>
    </div>
  );
}

// 시작 페이지
function StartPage({ totalBls, totalManifests, totalPages, blGroups }: { 
  totalBls: number; 
  totalManifests: number; 
  totalPages: number;
  blGroups: BlGroup[];
}) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="bg-white p-12 h-full w-full">
      <div className="h-full flex flex-col justify-center text-center space-y-8">
        <div className="border-t-4 border-b-4 border-slate-800 py-4">
          <h1 className="text-4xl font-bold">수입화물검역표 일괄 인쇄 시작</h1>
        </div>

        <div className="space-y-2 text-lg">
          <p>인쇄 날짜: {dateStr} {timeStr}</p>
        </div>

        <div className="space-y-2 text-xl font-semibold">
          <p>총 BL 개수: {totalBls}개</p>
          <p>총 화물표 개수: {totalManifests}개</p>
          <p>총 인쇄 페이지: {totalPages.toLocaleString()}장</p>
        </div>

        <div className="text-sm space-y-1 text-muted-foreground">
          <p>- 시작 페이지: 1장</p>
          <p>- 구분 페이지: {totalBls}장</p>
          <p>- 화물표: {(totalPages - totalBls - 2).toLocaleString()}장</p>
          <p>- 끝 페이지: 1장</p>
        </div>

        <div className="border-t-2 border-b-2 border-slate-600 py-6 mt-8">
          <h2 className="text-2xl font-semibold mb-4">BL 목록:</h2>
          <div className="space-y-1 text-left max-w-3xl mx-auto text-sm">
            {blGroups.map((group, idx) => (
              <p key={idx}>
                {idx + 1}. {group.blNo} ({group.totalManifests}건, {
                  group.items.map((item, i) => 
                    `${i > 0 ? ' + ' : ''}PLT ${item.pltQty} × ${item.copyCount}`
                  ).join('')
                } = {group.totalPages}장)
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// 구분 페이지
function SeparatorPage({ group }: { group: BlGroup }) {
  return (
    <div className="bg-white p-12 h-full w-full">
      <div className="h-full flex flex-col justify-center text-center space-y-8">
        <div className="border-t-4 border-b-4 border-slate-800 py-4">
          <h1 className="text-4xl font-bold">BL {group.blNo}</h1>
        </div>

        <div className="space-y-4 mt-8">
          <h2 className="text-2xl font-semibold">Item 목록:</h2>
          <div className="space-y-2 text-lg">
            {group.items.map((item, idx) => (
              <p key={idx}>
                {idx + 1}. {item.itemNo} (PLT {item.pltQty} × {item.copyCount} = {item.pltQty * item.copyCount}장)
              </p>
            ))}
          </div>
        </div>

        <div className="space-y-2 text-xl font-semibold mt-8">
          <p>총 화물표: {group.totalManifests}개</p>
          <p>총 인쇄 페이지: {group.totalPages}장</p>
        </div>
      </div>
    </div>
  );
}

// 끝 페이지
function EndPage({ totalBls, totalManifests, totalPages }: { 
  totalBls: number; 
  totalManifests: number; 
  totalPages: number;
}) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const timeStr = now.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="bg-white p-12 h-full w-full">
      <div className="h-full flex flex-col justify-center text-center space-y-8">
        <div className="border-t-4 border-b-4 border-slate-800 py-4">
          <h1 className="text-4xl font-bold">수입화물검역표 일괄 인쇄 완료</h1>
        </div>

        <div className="space-y-2 text-xl font-semibold">
          <p>총 BL 개수: {totalBls}개</p>
          <p>총 화물표 개수: {totalManifests}개</p>
          <p>총 인쇄 페이지: {totalPages.toLocaleString()}장</p>
        </div>

        <div className="space-y-2 text-lg">
          <p>인쇄 완료 시간: {dateStr} {timeStr}</p>
        </div>

        <div className="border-t-4 border-b-4 border-slate-800 py-4 mt-12">
          <h2 className="text-5xl font-bold">끝</h2>
        </div>
      </div>
    </div>
  );
}

// 화물표 페이지 (PresentationalManifest + ScaledManifest 사용)
function ManifestPage({ data, template }: { data: ManifestData; template: FormTemplate }) {
  const structure = template.structure as TemplateStructure;
  
  // A4 최적 scale 계산 (비율 무시, 상하좌우 최대)
  const baseDimensions = computeBaseDimensions(structure);
  const { scaleX, scaleY } = computeScaleForA4({
    baseWidthPx: baseDimensions.widthPx,
    baseHeightPx: baseDimensions.heightPx,
    targetMode: 'batch',
  });

  return (
    <div className="bg-white h-full w-full flex items-center justify-center">
      <div className="bg-white p-16 w-full h-full flex items-center justify-center">
        <ScaledManifest 
          scaleX={scaleX}
          scaleY={scaleY}
          baseWidthPx={baseDimensions.widthPx}
          baseHeightPx={baseDimensions.heightPx}
        >
          <PresentationalManifest data={data} template={template} />
        </ScaledManifest>
      </div>
    </div>
  );
}

// 기존 필드 렌더링 로직 (나중에 삭제 예정)
