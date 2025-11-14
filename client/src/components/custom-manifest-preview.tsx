import { type ManifestData, type FormTemplate, type TemplateStructure, type TemplateField } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Edit3, Save, X } from "lucide-react";
import { useRef, useState, useCallback, useEffect } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { calculateOptimalFontSize } from "@/lib/text-measurement";
import { PresentationalManifest } from "@/components/presentational-manifest";
import { ScaledManifest } from "@/components/scaled-manifest";
import { computeBaseDimensions, computeScaleForA4 } from "@/lib/manifest-scaling";

interface CustomManifestPreviewProps {
  data: ManifestData;
  template: FormTemplate;
}

export function CustomManifestPreview({ data, template }: CustomManifestPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const structure = template.structure as TemplateStructure;
  
  // 편집 모드 상태
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedFields, setEditedFields] = useState<TemplateField[]>(structure.fields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

  // 필드 값 가져오기
  const getFieldValue = (field: string): string => {
    const value = data[field as keyof ManifestData];
    return value != null ? String(value) : "";
  };

  // PDF 다운로드 (일괄인쇄와 동일한 A4 최적화 적용)
  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    
    try {
      // 렌더링 완료 대기 (폰트 및 레이아웃)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const element = printRef.current;
      const rect = element.getBoundingClientRect();
      
      const canvas = await html2canvas(element, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: rect.width,
        height: rect.height,
        windowWidth: rect.width,
        windowHeight: rect.height,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById('print-area');
          if (clonedElement) {
            // container query를 픽셀로 변환
            clonedElement.style.width = `${rect.width}px`;
            clonedElement.style.height = `${rect.height}px`;
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const pageWidth = 210;  // A4 너비
      const pageHeight = 297; // A4 높이
      const margin = 0;       // 여백 0mm (A4 전체 채우기)
      
      const availableWidth = pageWidth - (margin * 2);
      const availableHeight = pageHeight - (margin * 2);
      
      // 비율 무시하고 A4 전체를 채움 (일괄인쇄와 동일)
      const finalWidth = availableWidth;
      const finalHeight = availableHeight;
      
      const xOffset = margin;
      const yOffset = margin;
      
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, finalWidth, finalHeight);
      
      // 파일명: blNo_itemNo_2025-11-01_03-17-41.pdf
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
      
      // #을 제거한 Item 번호
      const cleanItemNo = (data.itemNo || 'unknown').replace(/^#/, '');
      const fileName = `${data.blNo || 'unknown'}_${cleanItemNo}_${dateStr}_${timeStr}.pdf`;
      
      pdf.save(fileName);
      
      toast({
        title: "PDF 다운로드 완료",
        description: "화물표가 PDF로 저장되었습니다.",
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: "오류",
        description: "PDF 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  // 인쇄
  const handlePrint = () => {
    // 파일명: blNo_itemNo_2025-11-01_03-17-41
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    
    // #을 제거한 Item 번호
    const cleanItemNo = (data.itemNo || 'unknown').replace(/^#/, '');
    const fileName = `${data.blNo || 'unknown'}_${cleanItemNo}_${dateStr}_${timeStr}`;
    
    console.log('=== PDF 파일명 설정 ===');
    console.log('B/L:', data.blNo);
    console.log('Item (원본):', data.itemNo);
    console.log('Item (정리):', cleanItemNo);
    console.log('생성된 파일명:', fileName);
    
    // 원래 title 저장
    const originalTitle = document.title;
    console.log('원래 title:', originalTitle);
    
    // 인쇄용 title 설정
    document.title = fileName;
    console.log('변경된 title:', document.title);
    
    // title 변경이 반영될 시간을 주고 인쇄 대화상자 열기
    setTimeout(() => {
      window.print();
      
      // title 복원 (인쇄 대화상자가 닫힌 후)
      setTimeout(() => {
        document.title = originalTitle;
        console.log('title 복원됨:', document.title);
      }, 1000);
    }, 100);
  };

  // 편집 모드 핸들러
  const handleEditToggle = useCallback(() => {
    if (isEditMode) {
      // 편집 취소
      setEditedFields(structure.fields);
      setSelectedFieldId(null);
    }
    setIsEditMode(!isEditMode);
  }, [isEditMode, structure.fields]);

  // 필드 드래그 시작
  const handleFieldMouseDown = useCallback((e: React.MouseEvent, fieldId: string) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedFieldId(fieldId);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isEditMode]);

  // 리사이즈 핸들 마우스다운
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, fieldId: string, handle: string) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedFieldId(fieldId);
    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isEditMode]);


  // 필드 속성 업데이트
  const updateFieldProperty = useCallback((fieldId: string, property: string, value: any) => {
    setEditedFields(prev => prev.map(field => {
      if (field.id === fieldId) {
        return { ...field, [property]: value };
      }
      return field;
    }));
  }, []);

  // 양식 저장
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedStructure: TemplateStructure = {
        ...structure,
        fields: editedFields,
      };

      await apiRequest('PUT', `/api/form-templates/${template.id}`, {
        name: template.name,
        structure: updatedStructure,
      });

      // 캐시 무효화
      await queryClient.invalidateQueries({ queryKey: ['/api/form-templates'] });

      toast({
        title: "저장 완료",
        description: "양식이 저장되었습니다. 모든 곳에 적용됩니다.",
      });

      setIsEditMode(false);
      setSelectedFieldId(null);
    } catch (error) {
      console.error('Save error:', error);
      toast({
        title: "오류",
        description: "저장 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedField = selectedFieldId 
    ? editedFields.find(f => f.id === selectedFieldId) 
    : null;

  // template prop이 변경되면 편집 상태 리셋
  useEffect(() => {
    setEditedFields(structure.fields);
    setSelectedFieldId(null);
    setIsEditMode(false);
  }, [template.id, structure.fields]);

  // 전역 마우스 이벤트로 드래그/리사이즈 처리
  useEffect(() => {
    if (!isEditMode) return;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!containerRef.current || !selectedFieldId) return;
      
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const scaleX = structure.imageWidth / containerRect.width;
      const scaleY = structure.imageHeight / containerRect.height;
      
      const scaledDeltaX = deltaX * scaleX;
      const scaledDeltaY = deltaY * scaleY;

      // 드래그 모드: 위치 이동
      if (isDragging && !isResizing) {
        setEditedFields(prev => prev.map(field => {
          if (field.id === selectedFieldId) {
            const newX = field.x + scaledDeltaX;
            const newY = field.y + scaledDeltaY;
            
            return {
              ...field,
              x: Math.max(0, Math.min(structure.imageWidth - field.width, newX)),
              y: Math.max(0, Math.min(structure.imageHeight - field.height, newY)),
            };
          }
          return field;
        }));
        
        setDragStart({ x: e.clientX, y: e.clientY });
      }

      // 리사이즈 모드: 크기 조정
      if (isResizing && resizeHandle) {
        setEditedFields(prev => prev.map(field => {
          if (field.id === selectedFieldId) {
            let newX = field.x;
            let newY = field.y;
            let newWidth = field.width;
            let newHeight = field.height;
            
            const minSize = 20; // 최소 크기

            // 핸들별 리사이즈 로직
            switch (resizeHandle) {
              case 'nw': // 왼쪽 위
                newX = field.x + scaledDeltaX;
                newY = field.y + scaledDeltaY;
                newWidth = field.width - scaledDeltaX;
                newHeight = field.height - scaledDeltaY;
                break;
              case 'n': // 위
                newY = field.y + scaledDeltaY;
                newHeight = field.height - scaledDeltaY;
                break;
              case 'ne': // 오른쪽 위
                newY = field.y + scaledDeltaY;
                newWidth = field.width + scaledDeltaX;
                newHeight = field.height - scaledDeltaY;
                break;
              case 'e': // 오른쪽
                newWidth = field.width + scaledDeltaX;
                break;
              case 'se': // 오른쪽 아래
                newWidth = field.width + scaledDeltaX;
                newHeight = field.height + scaledDeltaY;
                break;
              case 's': // 아래
                newHeight = field.height + scaledDeltaY;
                break;
              case 'sw': // 왼쪽 아래
                newX = field.x + scaledDeltaX;
                newWidth = field.width - scaledDeltaX;
                newHeight = field.height + scaledDeltaY;
                break;
              case 'w': // 왼쪽
                newX = field.x + scaledDeltaX;
                newWidth = field.width - scaledDeltaX;
                break;
            }

            // 최소 크기 및 경계 체크
            if (newWidth < minSize) {
              newWidth = minSize;
              if (resizeHandle.includes('w')) {
                newX = field.x + field.width - minSize;
              }
            }
            if (newHeight < minSize) {
              newHeight = minSize;
              if (resizeHandle.includes('n')) {
                newY = field.y + field.height - minSize;
              }
            }

            // 이미지 경계 체크
            newX = Math.max(0, Math.min(structure.imageWidth - newWidth, newX));
            newY = Math.max(0, Math.min(structure.imageHeight - newHeight, newY));
            
            return {
              ...field,
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight,
            };
          }
          return field;
        }));
        
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleGlobalMouseMove);
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isEditMode, isDragging, isResizing, resizeHandle, selectedFieldId, dragStart, structure.imageWidth, structure.imageHeight]);

  return (
    <div className={isEditMode ? "h-full flex flex-col" : ""}>
      {/* 편집 모드: 상단 버튼 영역 - 고정 */}
      {isEditMode && (
        <div className="flex-shrink-0 mb-4">
          <Card className="p-4">
            <div className="flex justify-between items-center gap-2">
              <div className="flex gap-2">
                <Button 
                  onClick={handleSave}
                  disabled={isSaving}
                  data-testid="button-save-template"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? "저장 중..." : "저장"}
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleEditToggle}
                  data-testid="button-cancel-edit"
                >
                  <X className="mr-2 h-4 w-4" />
                  취소
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 메인 영역 */}
      <div className={isEditMode ? "flex-1 overflow-hidden flex gap-4" : ""}>
        {/* 화물표 영역 */}
        <div className={isEditMode ? "flex-1 overflow-y-auto" : "w-full"}>
          <Card className="p-6">
            {/* 미리보기 모드: 상단 버튼들 */}
            {!isEditMode && (
              <div className="flex justify-between items-center gap-2 mb-4 no-print">
                <div className="flex gap-2">
                  <Button 
                    onClick={handlePrint}
                    data-testid="button-print-custom"
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    인쇄 / PDF 저장
                  </Button>
                </div>
              </div>
            )}

            {/* 화면 표시용 패딩 */}
            <div className="bg-white p-8">
              <>
              {/* 미리보기 모드: 화면 표시용 + 인쇄용 분리 */}
              {!isEditMode && (() => {
                const { widthPx, heightPx } = computeBaseDimensions(structure);
                
                // 화면 표시용 스케일링
                const previewScale = computeScaleForA4({
                  baseWidthPx: widthPx,
                  baseHeightPx: heightPx,
                  targetMode: 'preview',
                  maxScreenWidth: 1200,
                  maxScreenHeight: 900,
                });
                
                // 인쇄용 A4 최대화 스케일링
                const printScale = computeScaleForA4({
                  baseWidthPx: widthPx,
                  baseHeightPx: heightPx,
                  targetMode: 'print',
                });

                return (
                  <>
                    {/* 화면 표시용 */}
                    <div data-testid="custom-manifest-preview">
                      <ScaledManifest
                        scaleX={previewScale.scaleX}
                        scaleY={previewScale.scaleY}
                        baseWidthPx={widthPx}
                        baseHeightPx={heightPx}
                        className="mx-auto"
                      >
                        <PresentationalManifest
                          data={data}
                          template={template}
                        />
                      </ScaledManifest>
                    </div>
                    
                    {/* 인쇄용 (숨김) - A4 최대화 */}
                    <div 
                      ref={printRef} 
                      id="print-area" 
                      className="print-only"
                    >
                      <ScaledManifest
                        scaleX={printScale.scaleX}
                        scaleY={printScale.scaleY}
                        baseWidthPx={widthPx}
                        baseHeightPx={heightPx}
                      >
                        <PresentationalManifest
                          data={data}
                          template={template}
                        />
                      </ScaledManifest>
                    </div>
                  </>
                );
              })()}

              {/* 편집 모드: 기존 코드 유지 (절대 건드리지 않음) */}
              {isEditMode && (
                <div 
                  ref={printRef}
                  id="print-area"
                  className="relative mx-auto"
                  style={{ 
                    width: '100%',
                    maxWidth: structure.imageWidth,
                    aspectRatio: `${structure.imageWidth} / ${structure.imageHeight}`,
                    containerType: 'inline-size',
                  }}
                  data-testid="custom-manifest-preview"
                >
                  <div
                    ref={containerRef}
                    className="absolute inset-0"
                  >
                {/* 배경 이미지 */}
                <img 
                  src={structure.templateImage} 
                  alt={template.name}
                  className="absolute top-0 left-0 w-full h-full object-contain"
                  style={{ pointerEvents: 'none' }}
                />
                
                {/* 데이터 필드 오버레이 (편집 모드 전용) */}
                {editedFields.map((field: TemplateField) => {
            // 오버플로우 및 텍스트 처리 스타일 계산 (template-editor와 동일)
            const overflowStyle: React.CSSProperties = {};
            
            if (field.overflow === "hidden" || field.overflow === "ellipsis") {
              overflowStyle.overflow = "hidden";
              if (field.overflow === "ellipsis") {
                overflowStyle.textOverflow = "ellipsis";
                overflowStyle.whiteSpace = "nowrap";
              }
            }
            
            // maxLines 처리 (line-clamp)
            if (field.maxLines && field.maxLines > 0) {
              overflowStyle.display = "-webkit-box";
              overflowStyle.WebkitLineClamp = field.maxLines;
              overflowStyle.WebkitBoxOrient = "vertical";
              overflowStyle.overflow = "hidden";
            }
            
            // wordWrap 처리
            if (field.wordWrap) {
              overflowStyle.wordWrap = "break-word";
              overflowStyle.overflowWrap = "break-word";
              overflowStyle.whiteSpace = "normal";
            }
            
            // 비율 유지를 위해 퍼센트로 변환
            const leftPercent = (field.x / structure.imageWidth) * 100;
            const topPercent = (field.y / structure.imageHeight) * 100;
            const widthPercent = (field.width / structure.imageWidth) * 100;
            const heightPercent = (field.height / structure.imageHeight) * 100;
            
            // 편집 모드: Canvas measureText로 정확한 텍스트 너비 측정
            const isSelected = selectedFieldId === field.id;
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
            const scaleX = sizing.scaleX;
            const scaleY = sizing.scaleY;
            const baseFontSize = (finalFontSize / structure.imageWidth) * 100;
              
              return (
                <div 
                  key={field.id} 
                  className={`absolute ${field.stretchHeight ? 'overflow-hidden' : 'overflow-visible'}`}
                  style={{ left: `${leftPercent}%`, top: `${topPercent}%`, width: `${widthPercent}%`, height: `${heightPercent}%` }}
                >
                  <div
                    className={`relative w-full h-full flex items-center justify-center cursor-move ${isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-2 hover:ring-blue-300'}`}
                    style={{
                      background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                    }}
                    onMouseDown={(e) => handleFieldMouseDown(e, field.id)}
                    onClick={() => setSelectedFieldId(field.id)}
                    data-testid={`field-${field.id}`}
                  >
                    <div
                      style={{
                        fontSize: `${baseFontSize}cqw`,
                        color: field.color,
                        fontWeight: field.fontWeight,
                        lineHeight: '1',
                        whiteSpace: 'nowrap',
                        transform: field.stretchHeight ? `scale(${scaleX}, ${scaleY})` : undefined,
                        transformOrigin: field.stretchHeight ? 'center' : undefined,
                      }}
                    >
                      {textContent}
                    </div>
                    
                    {/* 리사이즈 핸들 (선택된 필드에만 표시) */}
                    {isSelected && (
                      <>
                        {/* 모서리 핸들 - 크기 5x5로 증가 */}
                        <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-blue-500 border-2 border-white rounded-sm cursor-nwse-resize z-50" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'nw')} />
                        <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-blue-500 border-2 border-white rounded-sm cursor-nesw-resize z-50" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'ne')} />
                        <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 bg-blue-500 border-2 border-white rounded-sm cursor-nesw-resize z-50" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'sw')} />
                        <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-blue-500 border-2 border-white rounded-sm cursor-nwse-resize z-50" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'se')} />
                        
                        {/* 가장자리 핸들 - 크기 5x5로 증가 */}
                        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-blue-500 border-2 border-white rounded-sm cursor-ns-resize z-50" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'n')} />
                        <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 bg-blue-500 border-2 border-white rounded-sm cursor-ns-resize z-50" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 's')} />
                        <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-5 h-5 bg-blue-500 border-2 border-white rounded-sm cursor-ew-resize z-50" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'w')} />
                        <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-5 h-5 bg-blue-500 border-2 border-white rounded-sm cursor-ew-resize z-50" onMouseDown={(e) => handleResizeMouseDown(e, field.id, 'e')} />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
                </div>
              </div>
              )}
              </>
            </div>

            <style>{`
              /* 화면에서는 인쇄용 컨테이너 숨김 */
              .print-only {
                position: absolute;
                left: -9999px;
                top: 0;
              }
              
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
                  width: 210mm !important;
                  height: 297mm !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: white !important;
                }
                
                /* 인쇄 시 다른 요소 숨김 */
                body * {
                  visibility: hidden !important;
                }
                
                /* print-area와 내부만 표시 */
                #print-area,
                #print-area * {
                  visibility: visible !important;
                }
                
                /* 인쇄용 컨테이너 위치 및 크기 강제 */
                .print-only {
                  position: fixed !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 210mm !important;
                  height: 297mm !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  transform: none !important;
                }
                
                #print-area {
                  position: fixed !important;
                  left: 0 !important;
                  top: 0 !important;
                  transform: none !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  width: 210mm !important;
                  height: 297mm !important;
                  max-width: none !important;
                  max-height: none !important;
                }
                
                /* ScaledManifest 내부 wrapper도 강제 조정 */
                #print-area > * {
                  position: relative !important;
                  width: 210mm !important;
                  height: 297mm !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
              }
            `}</style>
          </Card>
        </div>

        {/* 편집 모드: 속성 편집 패널 - 고정 */}
        {isEditMode && selectedField && (
          <Card className="w-80 overflow-y-auto p-4">
          <h3 className="font-semibold mb-4">필드 속성</h3>
          
          <div className="space-y-4">
            <div>
              <Label>필드: {selectedField.field}</Label>
              <p className="text-sm text-muted-foreground">ID: {selectedField.id}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="field-x">X 위치</Label>
                <Input
                  id="field-x"
                  type="number"
                  value={selectedField.x}
                  onChange={(e) => updateFieldProperty(selectedField.id, 'x', parseFloat(e.target.value))}
                  data-testid="input-field-x"
                />
              </div>
              <div>
                <Label htmlFor="field-y">Y 위치</Label>
                <Input
                  id="field-y"
                  type="number"
                  value={selectedField.y}
                  onChange={(e) => updateFieldProperty(selectedField.id, 'y', parseFloat(e.target.value))}
                  data-testid="input-field-y"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="field-width">너비</Label>
                <Input
                  id="field-width"
                  type="number"
                  value={selectedField.width}
                  onChange={(e) => updateFieldProperty(selectedField.id, 'width', parseFloat(e.target.value))}
                  data-testid="input-field-width"
                />
              </div>
              <div>
                <Label htmlFor="field-height">높이</Label>
                <Input
                  id="field-height"
                  type="number"
                  value={selectedField.height}
                  onChange={(e) => updateFieldProperty(selectedField.id, 'height', parseFloat(e.target.value))}
                  data-testid="input-field-height"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="field-fontSize">폰트 크기</Label>
              <Input
                id="field-fontSize"
                type="number"
                value={selectedField.fontSize}
                onChange={(e) => updateFieldProperty(selectedField.id, 'fontSize', parseFloat(e.target.value))}
                data-testid="input-field-fontSize"
              />
            </div>

            <div>
              <Label htmlFor="field-color">색상</Label>
              <Input
                id="field-color"
                type="color"
                value={selectedField.color}
                onChange={(e) => updateFieldProperty(selectedField.id, 'color', e.target.value)}
                data-testid="input-field-color"
              />
            </div>

            <div>
              <Label htmlFor="field-fontWeight">폰트 굵기</Label>
              <Select
                value={selectedField.fontWeight}
                onValueChange={(value) => updateFieldProperty(selectedField.id, 'fontWeight', value)}
              >
                <SelectTrigger id="field-fontWeight" data-testid="select-fontWeight">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">보통</SelectItem>
                  <SelectItem value="bold">굵게</SelectItem>
                  <SelectItem value="600">중간 굵게</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          </Card>
        )}
      </div>
    </div>
  );
}
