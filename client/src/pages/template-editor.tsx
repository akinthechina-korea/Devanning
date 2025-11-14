import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Save, Upload, Plus, Trash2, ArrowLeft } from "lucide-react";
import type { FormTemplate, TemplateField, TemplateStructure } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

// 유니패스 API 필드 (Unipass API에서 가져오는 데이터)
const UNIPASS_FIELDS = [
  // 기본 식별 정보
  { value: "화물관리번호", label: "화물관리번호 (cargMtNo)" },
  { value: "mblNo", label: "M B/L" },
  { value: "hblNo", label: "H B/L" },
  
  // 진행 상태
  { value: "csclPrgsStts", label: "통관진행상태" },
  { value: "prgsStts", label: "진행상태" },
  { value: "prcsDttm", label: "처리일시" },
  
  // 화물 정보
  { value: "prnm", label: "품명 (Unipass)" },
  { value: "수량", label: "수량 (포장개수)" },
  { value: "pckGcnt", label: "포장개수 (원시)" },
  { value: "pckUt", label: "포장단위" },
  { value: "중량", label: "중량" },
  { value: "ttwg", label: "총중량" },
  { value: "wghtUt", label: "중량단위" },
  { value: "msrm", label: "용적" },
  { value: "화물종류", label: "화물종류" },
  { value: "cargTp", label: "화물종류 (원시)" },
  
  // 선박/항공 정보
  { value: "선명", label: "선명" },
  { value: "shipNm", label: "선박명 (원시)" },
  { value: "shipNatNm", label: "선박국적" },
  { value: "shipNat", label: "선박국적 (코드)" },
  { value: "shcoFlco", label: "선사/항공사" },
  { value: "agnc", label: "선사대리점" },
  { value: "vydf", label: "항차" },
  
  // 항구/지역 정보
  { value: "입항일자", label: "입항일자" },
  { value: "etprDt", label: "입항일 (원시)" },
  { value: "etprCstm", label: "입항세관" },
  { value: "ldprNm", label: "적재항" },
  { value: "ldprCd", label: "적재항 (코드)" },
  { value: "dsprNm", label: "하선장소" },
  { value: "dsprCd", label: "하선장소 (코드)" },
  { value: "수출국명", label: "수출국명" },
  { value: "lodCntyCd", label: "적재국가 (코드)" },
  { value: "경유지", label: "경유지" },
  
  // 컨테이너 정보
  { value: "cntrGcnt", label: "컨테이너개수" },
  { value: "cntrNo", label: "컨테이너번호" },
  
  // B/L 정보
  { value: "blPtNm", label: "B/L유형" },
  { value: "blPt", label: "B/L유형 (코드)" },
  
  // 특수 정보
  { value: "spcnCargCd", label: "특수화물코드" },
  { value: "mtTrgtCargYnNm", label: "관리대상화물여부" },
  { value: "rlseDtyPridPassTpcd", label: "반출의무기간경과유형" },
  { value: "dclrDelyAdtxYn", label: "신고지연가산세여부" },
  { value: "frwrEntsConm", label: "특송업체명" },
];

// 입고리스트 필드 (데이터베이스 inbound_list 테이블에서 가져오는 데이터)
const INBOUND_LIST_FIELDS = [
  { value: "품명", label: "품명 (Description)" },
  { value: "contNo", label: "CONT No. (컨테이너번호)" },
  { value: "dryWet", label: "DRY/WET (구분)" },
  { value: "검역사항", label: "검역사항" },
  { value: "blNo", label: "B/L No." },
  { value: "수입자", label: "수입자" },
  { value: "반입일자", label: "반입일자" },
  { value: "palletQty", label: "Pallet Q'ty (기존)" },
  { value: "plt", label: "PLT" },
  { value: "매수", label: "매수" },
  { value: "bl수량", label: "B/L수량 (QTY)" },
  { value: "tie", label: "TIE" },
  { value: "sellUnitPerCase", label: "SELL UNIT PER CASE (UNIT)" },
  { value: "do", label: "DO (Dept)" },
  { value: "itemNo", label: "Item No." },
  { value: "수량Pcs", label: "수량(PCS) (MPK)" },
  { value: "높이", label: "높이" },
  { value: "소비기한", label: "소비기한 (도착예정Time)" },
  { value: "특이사항", label: "특이사항 (비고)" },
  { value: "costcoBlNo", label: "Costco B/L No." },
];

// 전체 필드 목록 (검색용)
const ALL_FIELDS = [...UNIPASS_FIELDS, ...INBOUND_LIST_FIELDS];

export default function TemplateEditor() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isAdmin, isLoading: authLoading } = useAuth();
  
  const [templateName, setTemplateName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ mouseX: 0, mouseY: 0, fieldX: 0, fieldY: 0, width: 0, height: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 관리자가 아니면 redirect
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast({
        title: "접근 권한 없음",
        description: "양식 편집 페이지는 관리자만 접근할 수 있습니다.",
        variant: "destructive",
      });
      navigate("/");
    }
  }, [authLoading, isAdmin, navigate, toast]);

  // 기존 템플릿 로드
  const { data: template, isLoading } = useQuery<FormTemplate>({
    queryKey: ["/api/form-templates", id],
    enabled: !!id && id !== "new",
  });

  // 템플릿 로드 시 상태 초기화
  useEffect(() => {
    if (template) {
      setTemplateName(template.name);
      const structure = template.structure as TemplateStructure;
      
      // 이미지 URL 설정 (있으면)
      if (structure.templateImage) {
        setImageUrl(structure.templateImage);
      }
      
      // 이미지 크기 설정
      if (structure.imageWidth && structure.imageHeight) {
        setImageSize({ width: structure.imageWidth, height: structure.imageHeight });
      }
      
      // 필드 설정 (항상)
      if (structure.fields && structure.fields.length > 0) {
        setFields(structure.fields);
      }
    }
  }, [template]);

  // 이미지 업로드 처리
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImageUrl(event.target?.result as string);
        setImageSize({ width: img.width, height: img.height });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  // 새 필드 추가 - 현재 스크롤 위치 기반
  const handleAddField = useCallback(() => {
    let newX = 50;
    let newY = 50;
    
    // 스크롤 컨테이너가 있으면 현재 보이는 영역의 중앙에 필드 생성
    if (scrollContainerRef.current && containerRef.current) {
      const scrollContainer = scrollContainerRef.current;
      const imageContainer = containerRef.current;
      
      // 스크롤 위치
      const scrollTop = scrollContainer.scrollTop;
      const scrollLeft = scrollContainer.scrollLeft;
      
      // 보이는 영역 크기
      const viewportWidth = scrollContainer.clientWidth;
      const viewportHeight = scrollContainer.clientHeight;
      
      // 보이는 영역의 중앙 계산 (이미지 좌표계 기준)
      newX = scrollLeft + (viewportWidth / 2) - 100; // 필드 너비의 절반(100px)을 빼서 중앙 정렬
      newY = scrollTop + (viewportHeight / 2) - 15; // 필드 높이의 절반(15px)을 빼서 중앙 정렬
      
      // 이미지 범위를 벗어나지 않도록 제한
      newX = Math.max(0, Math.min(newX, imageSize.width - 200));
      newY = Math.max(0, Math.min(newY, imageSize.height - 30));
    }
    
    const newField: TemplateField = {
      id: `field-${Date.now()}`,
      x: newX,
      y: newY,
      width: 200,
      height: 30,
      field: "품명",
      fontSize: 14,
      color: "#000000",
      fontWeight: "normal",
      textAlign: "center",
      // 값 표시 범위 기본값
      overflow: "visible",
      wordWrap: false,
      stretchHeight: false,
    };
    setFields([...fields, newField]);
    setSelectedFieldId(newField.id);
  }, [fields, imageSize]);

  // 필드 삭제
  const handleDeleteField = useCallback((fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  }, [fields, selectedFieldId]);

  // 필드 속성 업데이트
  const handleUpdateField = useCallback((fieldId: string, updates: Partial<TemplateField>) => {
    setFields(fields.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  }, [fields]);

  // 드래그 시작
  const handleMouseDown = useCallback((e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    
    setIsDragging(true);
    setSelectedFieldId(fieldId);
    
    const rect = containerRef.current.getBoundingClientRect();
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      // 컨테이너 내부의 마우스 위치에서 필드의 시작 위치를 빼서 offset 계산
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setDragStart({ x: mouseX - field.x, y: mouseY - field.y });
    }
  }, [fields]);

  // 리사이즈 시작
  const handleResizeStart = useCallback((e: React.MouseEvent, fieldId: string, handle: string) => {
    e.stopPropagation();
    if (!containerRef.current) return;
    
    setIsResizing(true);
    setResizeHandle(handle);
    setSelectedFieldId(fieldId);
    
    const field = fields.find(f => f.id === fieldId);
    if (field) {
      const rect = containerRef.current.getBoundingClientRect();
      setResizeStart({
        mouseX: e.clientX - rect.left,
        mouseY: e.clientY - rect.top,
        fieldX: field.x,
        fieldY: field.y,
        width: field.width,
        height: field.height
      });
    }
  }, [fields]);

  // 드래그 중 또는 리사이즈 중
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !selectedFieldId) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const field = fields.find(f => f.id === selectedFieldId);
    if (!field) return;

    if (isResizing && resizeHandle) {
      // 리사이즈 처리
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const deltaX = mouseX - resizeStart.mouseX;
      const deltaY = mouseY - resizeStart.mouseY;

      let newX = resizeStart.fieldX;
      let newY = resizeStart.fieldY;
      let newWidth = resizeStart.width;
      let newHeight = resizeStart.height;

      // 8방향 핸들 처리
      if (resizeHandle.includes('e')) {
        newWidth = Math.max(20, resizeStart.width + deltaX);
      }
      if (resizeHandle.includes('w')) {
        const widthChange = -deltaX;
        newWidth = Math.max(20, resizeStart.width + widthChange);
        newX = resizeStart.fieldX + (resizeStart.width - newWidth);
      }
      if (resizeHandle.includes('s')) {
        newHeight = Math.max(10, resizeStart.height + deltaY);
      }
      if (resizeHandle.includes('n')) {
        const heightChange = -deltaY;
        newHeight = Math.max(10, resizeStart.height + heightChange);
        newY = resizeStart.fieldY + (resizeStart.height - newHeight);
      }

      // 이미지 경계 체크
      newX = Math.max(0, Math.min(newX, imageSize.width - newWidth));
      newY = Math.max(0, Math.min(newY, imageSize.height - newHeight));
      newWidth = Math.min(newWidth, imageSize.width - newX);
      newHeight = Math.min(newHeight, imageSize.height - newY);

      handleUpdateField(selectedFieldId, { x: newX, y: newY, width: newWidth, height: newHeight });
    } else if (isDragging) {
      // 이동 처리
      const x = Math.max(0, Math.min(e.clientX - rect.left - dragStart.x, imageSize.width - field.width));
      const y = Math.max(0, Math.min(e.clientY - rect.top - dragStart.y, imageSize.height - field.height));
      handleUpdateField(selectedFieldId, { x, y });
    }
  }, [isDragging, isResizing, resizeHandle, selectedFieldId, dragStart, resizeStart, imageSize, fields, handleUpdateField]);

  // 드래그 또는 리사이즈 종료
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
  }, []);

  // 저장 mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!templateName || !imageUrl) {
        throw new Error("템플릿 이름과 이미지를 입력해주세요.");
      }

      const structure: TemplateStructure = {
        templateImage: imageUrl,
        imageWidth: imageSize.width,
        imageHeight: imageSize.height,
        fields,
      };

      const data = {
        name: templateName,
        structure,
      };

      if (id && id !== "new") {
        return apiRequest("PUT", `/api/form-templates/${id}`, data);
      } else {
        return apiRequest("POST", "/api/form-templates", data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      toast({
        title: "저장 완료",
        description: "양식이 저장되었습니다.",
      });
      // 저장 후 그대로 편집기에 남아있음
    },
    onError: (error: Error) => {
      toast({
        title: "저장 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const selectedField = fields.find(f => f.id === selectedFieldId);

  if (isLoading) {
    return <div className="p-6">로딩 중...</div>;
  }

  return (
    <div className="w-full h-screen flex flex-col">
      {/* 상단 헤더 - 고정 */}
      <div className="sticky top-0 z-50 flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/templates")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">양식 편집기</h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-upload-image"
            >
              <Upload className="mr-2 h-4 w-4" />
              이미지 업로드
            </Button>
            <Button
              variant="outline"
              onClick={handleAddField}
              disabled={!imageUrl}
              data-testid="button-add-field"
            >
              <Plus className="mr-2 h-4 w-4" />
              필드 추가
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !templateName || !imageUrl}
              data-testid="button-save-template"
            >
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
          data-testid="input-image-file"
        />
        
        {/* 양식 이름 - 고정 */}
        <div className="px-4 pb-4">
          <Label htmlFor="template-name">양식 이름</Label>
          <Input
            id="template-name"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="예: 수입화물검역표"
            data-testid="input-template-name"
            className="max-w-md"
          />
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 왼쪽: 이미지 캔버스 - 스크롤 가능 */}
        <div ref={scrollContainerRef} className="flex-1 p-6 overflow-auto">
          {imageUrl ? (
            <div
              ref={containerRef}
              className="relative border-2 border-dashed border-border rounded-lg inline-block"
              style={{ width: imageSize.width, height: imageSize.height }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img src={imageUrl} alt="Template background" className="w-full h-full pointer-events-none select-none" />
              
              {/* 필드들 */}
              {fields.map((field) => {
                // 오버플로우 및 텍스트 처리 스타일 계산
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
                
                // 영역 크기에 맞춰 폰트 크기 자동 조정
                const textContent = field.field || "";
                const textLength = textContent.length || 1;
                
                // 가로 기준으로 폰트 크기 계산 (넘치지 않게)
                const maxFontSizeByWidth = (field.width * 0.95) / (textLength * 0.7);
                
                // stretchHeight 옵션에 따라 처리
                let finalFontSize = maxFontSizeByWidth;
                let scaleX = 1;
                let scaleY = 1;
                
                if (field.stretchHeight) {
                  // 너비/높이 모두 100% 채우기
                  // 가로는 텍스트가 딱 맞게, 세로는 박스 높이에 맞게 늘림
                  finalFontSize = maxFontSizeByWidth;
                  
                  // 세로만 박스 높이에 맞춰 늘림
                  scaleX = 1;
                  scaleY = field.height / maxFontSizeByWidth;
                } else {
                  // 비율 유지: 높이도 고려하여 폰트 크기 조정
                  const maxFontSizeByHeight = field.height * 0.95;
                  finalFontSize = Math.min(maxFontSizeByWidth, maxFontSizeByHeight);
                }
                
                return (
                  <div
                    key={field.id}
                    className={`absolute border-2 cursor-move ${
                      field.stretchHeight ? 'overflow-hidden' : 'overflow-visible'
                    } ${
                      selectedFieldId === field.id
                        ? "border-primary bg-primary/10"
                        : "border-blue-400 bg-blue-400/20"
                    }`}
                    style={{
                      left: field.x,
                      top: field.y,
                      width: field.width,
                      height: field.height,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, field.id)}
                    data-testid={`field-${field.id}`}
                  >
                    {/* 텍스트 - stretchHeight 옵션에 따라 렌더링 */}
                    <div 
                      className="pointer-events-none select-none w-full h-full flex items-center justify-center"
                      style={{
                        fontSize: `${finalFontSize}px`,
                        color: field.color,
                        fontWeight: field.fontWeight,
                        lineHeight: '1',
                        transform: field.stretchHeight ? `scale(${scaleX}, ${scaleY})` : undefined,
                        transformOrigin: field.stretchHeight ? 'center' : undefined,
                        ...overflowStyle,
                      }}
                    >
                      {field.field}
                    </div>

                    {/* 리사이즈 핸들 (선택된 필드만 표시) */}
                    {selectedFieldId === field.id && (
                      <>
                        {/* 모서리 핸들 */}
                        <div className="absolute w-3 h-3 bg-primary border border-white cursor-nw-resize" style={{ top: -4, left: -4 }} onMouseDown={(e) => handleResizeStart(e, field.id, 'nw')} />
                        <div className="absolute w-3 h-3 bg-primary border border-white cursor-ne-resize" style={{ top: -4, right: -4 }} onMouseDown={(e) => handleResizeStart(e, field.id, 'ne')} />
                        <div className="absolute w-3 h-3 bg-primary border border-white cursor-se-resize" style={{ bottom: -4, right: -4 }} onMouseDown={(e) => handleResizeStart(e, field.id, 'se')} />
                        <div className="absolute w-3 h-3 bg-primary border border-white cursor-sw-resize" style={{ bottom: -4, left: -4 }} onMouseDown={(e) => handleResizeStart(e, field.id, 'sw')} />
                        
                        {/* 변 중앙 핸들 */}
                        <div className="absolute w-3 h-3 bg-primary border border-white cursor-n-resize" style={{ top: -4, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => handleResizeStart(e, field.id, 'n')} />
                        <div className="absolute w-3 h-3 bg-primary border border-white cursor-e-resize" style={{ top: '50%', right: -4, transform: 'translateY(-50%)' }} onMouseDown={(e) => handleResizeStart(e, field.id, 'e')} />
                        <div className="absolute w-3 h-3 bg-primary border border-white cursor-s-resize" style={{ bottom: -4, left: '50%', transform: 'translateX(-50%)' }} onMouseDown={(e) => handleResizeStart(e, field.id, 's')} />
                        <div className="absolute w-3 h-3 bg-primary border border-white cursor-w-resize" style={{ top: '50%', left: -4, transform: 'translateY(-50%)' }} onMouseDown={(e) => handleResizeStart(e, field.id, 'w')} />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
              <p className="text-muted-foreground">이미지를 업로드해주세요</p>
            </div>
          )}
        </div>

        {/* 오른쪽: 속성 편집 패널 */}
        <div className="w-80 border-l bg-muted/30 flex flex-col">
          {/* 패널 헤더 - 고정 */}
          <div className="flex-shrink-0 p-6 border-b">
            <h2 className="text-xl font-bold">필드 속성</h2>
          </div>
          
          {/* 패널 내용 - 스크롤 가능 */}
          <div className="flex-1 overflow-auto p-6">
            {selectedField ? (
              <div className="space-y-4 pb-4">
                <div>
                  <Label>데이터 필드</Label>
                  <Select
                    value={selectedField.field}
                    onValueChange={(value) => handleUpdateField(selectedField.id, { field: value })}
                  >
                    <SelectTrigger data-testid="select-field-mapping">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-80">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        유니패스 API 필드
                      </div>
                      {UNIPASS_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                      <div className="my-1 h-px bg-border" />
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        입고리스트 필드
                      </div>
                      {INBOUND_LIST_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>X 위치</Label>
                    <Input
                      type="number"
                      value={selectedField.x}
                      onChange={(e) => handleUpdateField(selectedField.id, { x: Number(e.target.value) })}
                      data-testid="input-field-x"
                    />
                  </div>
                  <div>
                    <Label>Y 위치</Label>
                    <Input
                      type="number"
                      value={selectedField.y}
                      onChange={(e) => handleUpdateField(selectedField.id, { y: Number(e.target.value) })}
                      data-testid="input-field-y"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>너비</Label>
                    <Input
                      type="number"
                      value={selectedField.width}
                      onChange={(e) => handleUpdateField(selectedField.id, { width: Number(e.target.value) })}
                      data-testid="input-field-width"
                    />
                  </div>
                  <div>
                    <Label>높이</Label>
                    <Input
                      type="number"
                      value={selectedField.height}
                      onChange={(e) => handleUpdateField(selectedField.id, { height: Number(e.target.value) })}
                      data-testid="input-field-height"
                    />
                  </div>
                </div>

                <div>
                  <Label>폰트 크기</Label>
                  <Input
                    type="number"
                    value={selectedField.fontSize}
                    onChange={(e) => handleUpdateField(selectedField.id, { fontSize: Number(e.target.value) })}
                    data-testid="input-field-fontsize"
                  />
                </div>

                <div>
                  <Label>텍스트 색상</Label>
                  <Input
                    type="color"
                    value={selectedField.color}
                    onChange={(e) => handleUpdateField(selectedField.id, { color: e.target.value })}
                    data-testid="input-field-color"
                  />
                </div>

                <div>
                  <Label>폰트 굵기</Label>
                  <Select
                    value={selectedField.fontWeight}
                    onValueChange={(value) => handleUpdateField(selectedField.id, { fontWeight: value })}
                  >
                    <SelectTrigger data-testid="select-field-fontweight">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">보통</SelectItem>
                      <SelectItem value="bold">굵게</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`stretch-${selectedField.id}`}
                    checked={selectedField.stretchHeight || false}
                    onCheckedChange={(checked) => handleUpdateField(selectedField.id, { stretchHeight: checked as boolean })}
                    data-testid="checkbox-stretch-height"
                  />
                  <Label htmlFor={`stretch-${selectedField.id}`} className="cursor-pointer">
                    영역 100% 채우기 (가로/세로 늘림)
                  </Label>
                </div>

                <Button
                  variant="destructive"
                  onClick={() => handleDeleteField(selectedField.id)}
                  className="w-full"
                  data-testid="button-delete-field"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  필드 삭제
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">필드를 선택하여 속성을 편집하세요</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
