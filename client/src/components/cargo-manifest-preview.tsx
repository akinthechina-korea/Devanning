import { type CargoTrackingResult, type ManifestData } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, Edit3, Save, X } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// 셀 스타일 타입
interface CellStyle {
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  color: string;
}

// 필드별 스타일 설정
type ManifestStyles = {
  [K in keyof ManifestData]: CellStyle;
};

// 기본 스타일 설정
const getDefaultStyles = (): ManifestStyles => ({
  품명: { fontSize: 18, fontWeight: 'normal', color: '#000000' },
  수량: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
  중량: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
  입항일자: { fontSize: 18, fontWeight: 'normal', color: '#000000' },
  contNo: { fontSize: 18, fontWeight: 'normal', color: '#000000' },
  화물종류: { fontSize: 18, fontWeight: 'normal', color: '#000000' },
  dryWet: { fontSize: 60, fontWeight: 'bold', color: '#000000' },
  수출국명: { fontSize: 18, fontWeight: 'normal', color: '#000000' },
  선명: { fontSize: 18, fontWeight: 'normal', color: '#000000' },
  검역사항: { fontSize: 18, fontWeight: 'normal', color: '#000000' },
  경유지: { fontSize: 18, fontWeight: 'normal', color: '#000000' },
  blNo: { fontSize: 40, fontWeight: 'bold', color: '#000000' },
  화물관리번호: { fontSize: 30, fontWeight: 'bold', color: '#000000' },
  수입자: { fontSize: 20, fontWeight: 'bold', color: '#000000' },
  반입일자: { fontSize: 30, fontWeight: 'bold', color: '#000000' },
  plt: { fontSize: 30, fontWeight: 'bold', color: '#000000' },
  bl수량: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
  tie: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
  sellUnitPerCase: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
  do: { fontSize: 60, fontWeight: 'bold', color: '#000000' },
  itemNo: { fontSize: 60, fontWeight: 'bold', color: '#000000' },
  수량Pcs: { fontSize: 30, fontWeight: 'bold', color: '#000000' },
  높이: { fontSize: 30, fontWeight: 'bold', color: '#000000' },
  소비기한: { fontSize: 22, fontWeight: 'bold', color: '#000000' },
  특이사항: { fontSize: 20, fontWeight: 'bold', color: '#dc2626' },
  costcoBlNo: { fontSize: 90, fontWeight: 'bold', color: '#000000' },
});

// Excel 날짜 숫자를 실제 날짜 문자열로 변환 (YYYY.MM.DD 형식)
function excelDateToString(excelDate: string): string {
  if (!excelDate || excelDate === '-') return '-';
  
  const numDate = parseInt(excelDate);
  if (isNaN(numDate)) return excelDate;
  
  // Excel 날짜는 1900년 1월 1일부터 시작 (하지만 Excel 버그로 1900.1.0 기준)
  const excelEpoch = new Date(1899, 11, 30); // 1899년 12월 30일
  const date = new Date(excelEpoch.getTime() + numDate * 24 * 60 * 60 * 1000);
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}.${month}.${day}`;
}

interface CargoManifestPreviewProps {
  data: CargoTrackingResult | ManifestData;
  mode?: 'tracking' | 'inbound'; // tracking: 기존 화물검색, inbound: 입고리스트
}

// 편집 가능한 셀 컴포넌트
interface EditableCellProps {
  field: keyof ManifestData;
  value: string;
  isEditMode: boolean;
  style: CellStyle;
  onStyleChange: (field: keyof ManifestData, style: Partial<CellStyle>) => void;
  autoResize?: boolean;
}

// 텍스트 길이에 따라 자동으로 글자 크기 계산
function calculateFontSize(text: string, maxSize: number, minSize: number = 20): number {
  const textLength = text.length;
  if (textLength === 0) return maxSize;
  
  // 글자 수가 적을수록 크게, 많을수록 작게
  if (textLength <= 5) return maxSize;
  if (textLength <= 10) return Math.max(maxSize * 0.8, minSize);
  if (textLength <= 15) return Math.max(maxSize * 0.6, minSize);
  return Math.max(maxSize * 0.4, minSize);
}

function EditableCell({ field, value, isEditMode, style, onStyleChange, autoResize = false }: EditableCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localStyle, setLocalStyle] = useState(style);

  useEffect(() => {
    setLocalStyle(style);
  }, [style]);

  const handleApply = () => {
    onStyleChange(field, localStyle);
    setIsOpen(false);
  };

  // autoResize가 true면 텍스트 길이에 따라 자동 크기 조정
  const fontSize = autoResize 
    ? calculateFontSize(value, style.fontSize)
    : style.fontSize;

  const cellStyle = {
    fontSize: `${fontSize}px`,
    fontWeight: style.fontWeight,
    color: style.color,
  };

  if (!isEditMode) {
    return <span style={cellStyle}>{value}</span>;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <span 
          style={cellStyle}
          className="cursor-pointer hover:bg-yellow-100 transition-colors rounded px-1"
          data-testid={`editable-cell-${field}`}
        >
          {value}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-80" data-testid="style-editor">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">스타일 편집: {field}</h4>
            <p className="text-sm text-muted-foreground">
              폰트 크기, 굵기, 색상을 변경하세요.
            </p>
          </div>
          
          <div className="grid gap-2">
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor={`fontSize-${field}`}>크기 (px)</Label>
              <Input
                id={`fontSize-${field}`}
                type="number"
                value={localStyle.fontSize}
                onChange={(e) => setLocalStyle({ ...localStyle, fontSize: parseInt(e.target.value) || 18 })}
                className="col-span-2 h-8"
                data-testid="input-font-size"
              />
            </div>
            
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor={`fontWeight-${field}`}>굵기</Label>
              <select
                id={`fontWeight-${field}`}
                value={localStyle.fontWeight}
                onChange={(e) => setLocalStyle({ ...localStyle, fontWeight: e.target.value as 'normal' | 'bold' })}
                className="col-span-2 h-8 rounded-md border border-input bg-background px-3 py-1 text-sm"
                data-testid="select-font-weight"
              >
                <option value="normal">보통</option>
                <option value="bold">굵게</option>
              </select>
            </div>
            
            <div className="grid grid-cols-3 items-center gap-4">
              <Label htmlFor={`color-${field}`}>색상</Label>
              <div className="col-span-2 flex gap-2">
                <Input
                  id={`color-${field}`}
                  type="color"
                  value={localStyle.color}
                  onChange={(e) => setLocalStyle({ ...localStyle, color: e.target.value })}
                  className="h-8 w-16"
                  data-testid="input-color"
                />
                <Input
                  type="text"
                  value={localStyle.color}
                  onChange={(e) => setLocalStyle({ ...localStyle, color: e.target.value })}
                  className="h-8 flex-1"
                  placeholder="#000000"
                  data-testid="input-color-hex"
                />
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleApply} size="sm" className="flex-1" data-testid="button-apply-style">
              적용
            </Button>
            <Button onClick={() => setIsOpen(false)} size="sm" variant="outline" data-testid="button-cancel-style">
              취소
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function CargoManifestPreview({ data: _data, mode = 'tracking' }: CargoManifestPreviewProps) {
  // ManifestData로 변환
  const data: ManifestData = mode === 'inbound' 
    ? (_data as ManifestData) 
    : (() => {
        // tracking 모드: CargoTrackingResult를 ManifestData로 변환
        const trackingData = _data as CargoTrackingResult;
        const basicInfo = trackingData.basicInfo;
        const containers = trackingData.containers || [];
        
        return {
          // 1-13: Unipass API에서 가져올 수 있는 필드
          품명: basicInfo.itemName || '-',
          수량: basicInfo.pkgCount || '-',
          중량: basicInfo.totalWeight || '-',
          입항일자: '-', // arrivalReport에서 가져올 수 있음
          contNo: containers.length > 0 ? containers[0].containerNo : '-',
          화물종류: basicInfo.cargoType || '-',
          dryWet: '-', // 입고리스트에서만 제공
          수출국명: '-', // basicInfo에서 가져올 수 있음
          선명: basicInfo.shipName || '-',
          검역사항: '-',
          경유지: '-',
          blNo: basicInfo.mblNo || '-',
          화물관리번호: basicInfo.cargoId || '-',
          // 14-25: 입고리스트에서만 제공되는 필드 (tracking 모드에서는 비움)
          수입자: '-',
          반입일자: '-',
          plt: '-',
          bl수량: '-',
          tie: '-',
          sellUnitPerCase: '-',
          do: '-',
          itemNo: '-',
          수량Pcs: '-',
          높이: '-',
          소비기한: '-',
          특이사항: '-',
          costcoBlNo: '-',
        };
      })();
  const manifestRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [styles, setStyles] = useState<ManifestStyles>(getDefaultStyles());
  const { toast } = useToast();

  // localStorage에서 스타일 불러오기
  useEffect(() => {
    const savedStyles = localStorage.getItem('manifest-cell-styles');
    if (savedStyles) {
      try {
        const parsed = JSON.parse(savedStyles);
        const defaultStyles = getDefaultStyles();
        
        // 각 필드별로 깊게 병합하여 누락된 속성이 없도록 함
        const mergedStyles: ManifestStyles = {} as ManifestStyles;
        Object.keys(defaultStyles).forEach((key) => {
          const field = key as keyof ManifestData;
          mergedStyles[field] = {
            fontSize: parsed[field]?.fontSize !== undefined ? Number(parsed[field].fontSize) : defaultStyles[field].fontSize,
            fontWeight: parsed[field]?.fontWeight || defaultStyles[field].fontWeight,
            color: parsed[field]?.color || defaultStyles[field].color,
          };
        });
        
        setStyles(mergedStyles);
      } catch (error) {
        console.error('스타일 불러오기 실패:', error);
      }
    }
  }, []);

  // 스타일 저장
  const saveStyles = () => {
    localStorage.setItem('manifest-cell-styles', JSON.stringify(styles));
    toast({
      title: "스타일 저장됨",
      description: "현재 스타일 설정이 저장되었습니다.",
    });
    setIsEditMode(false);
  };

  // 스타일 초기화
  const resetStyles = () => {
    const defaultStyles = getDefaultStyles();
    setStyles(defaultStyles);
    localStorage.setItem('manifest-cell-styles', JSON.stringify(defaultStyles));
    toast({
      title: "스타일 초기화됨",
      description: "기본 스타일로 복원되었습니다.",
    });
  };

  // 필드 스타일 업데이트
  const updateFieldStyle = (field: keyof ManifestData, style: Partial<CellStyle>) => {
    setStyles(prev => ({
      ...prev,
      [field]: { ...prev[field], ...style }
    }));
  };

  // 스타일 적용 헬퍼 함수
  const getFieldStyle = (field: keyof ManifestData) => {
    const style = styles[field];
    return {
      fontSize: `${style.fontSize}px`,
      fontWeight: style.fontWeight,
      color: style.color
    };
  };

  const handleDownloadPDF = async () => {
    if (!manifestRef.current || isGeneratingPDF) return;

    setIsGeneratingPDF(true);
    try {
      const canvas = await html2canvas(manifestRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const imageData = canvas.toDataURL("image/png");
      
      const pdf = new jsPDF("p", "mm", "a4");
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imageData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imageData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `화물표_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
      toast({
        title: "PDF 다운로드 완료",
        description: `${fileName} 파일이 다운로드되었습니다.`,
      });
    } catch (error) {
      console.error("PDF 생성 중 오류:", error);
      toast({
        title: "PDF 생성 실패",
        description: "PDF 생성 중 오류가 발생했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 print:hidden">
        <Button 
          onClick={handleDownloadPDF} 
          variant="default" 
          size="default"
          disabled={isGeneratingPDF}
          data-testid="button-download-pdf"
        >
          <Download className="w-4 h-4 mr-2" />
          {isGeneratingPDF ? "PDF 생성 중..." : "PDF 다운로드"}
        </Button>
        <Button 
          onClick={handlePrint} 
          variant="outline" 
          size="default"
          data-testid="button-print"
        >
          <Printer className="w-4 h-4 mr-2" />
          인쇄하기
        </Button>
        
        {!isEditMode ? (
          <Button 
            onClick={() => setIsEditMode(true)} 
            variant="outline" 
            size="default"
            data-testid="button-edit-mode"
          >
            <Edit3 className="w-4 h-4 mr-2" />
            스타일 편집
          </Button>
        ) : (
          <>
            <Button 
              onClick={saveStyles} 
              variant="default" 
              size="default"
              data-testid="button-save-styles"
            >
              <Save className="w-4 h-4 mr-2" />
              저장
            </Button>
            <Button 
              onClick={() => setIsEditMode(false)} 
              variant="outline" 
              size="default"
              data-testid="button-cancel-edit"
            >
              <X className="w-4 h-4 mr-2" />
              취소
            </Button>
            <Button 
              onClick={resetStyles} 
              variant="destructive" 
              size="default"
              data-testid="button-reset-styles"
            >
              초기화
            </Button>
          </>
        )}
      </div>
      
      {isEditMode && (
        <Card className="p-4 mb-4 bg-blue-50 border-blue-200">
          <p className="text-sm text-blue-800">
            편집 모드: 수정하려는 값을 클릭하면 스타일을 변경할 수 있습니다.
          </p>
        </Card>
      )}
      <Card ref={manifestRef} className="p-8 bg-white text-black print:shadow-none" data-testid="manifest-preview">
        {/* 제목 */}
        <div className="text-center mb-4">
          <h1 className="text-lg font-bold">수입화물[검역]표</h1>
        </div>

        {/* 메인 테이블 */}
        <div className="border border-black">
          <table className="w-full text-lg">
            <tbody>
              {/* 품명 행 */}
              <tr className="border-b border-black">
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">품명</td>
                <td className="p-1 text-center align-middle" colSpan={3}>
                  <EditableCell field="품명" value={data.품명} isEditMode={isEditMode} style={styles.품명} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
              
              {/* 수량/중량 행 */}
              <tr className="border-b border-black">
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">수량 / 중량</td>
                <td className="w-1/2 p-1 text-center border-r border-black align-middle">
                  <EditableCell field="수량" value={data.수량} isEditMode={isEditMode} style={styles.수량} onStyleChange={updateFieldStyle} />
                </td>
                <td className="p-1 text-center align-middle" colSpan={2}>
                  <EditableCell field="중량" value={data.중량} isEditMode={isEditMode} style={styles.중량} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
              
              {/* 입항일자 행 */}
              <tr className="border-b border-black">
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">입항일자</td>
                <td className="p-1 text-center border-r border-black align-middle" colSpan={2}>
                  <EditableCell field="입항일자" value={data.입항일자} isEditMode={isEditMode} style={styles.입항일자} onStyleChange={updateFieldStyle} />
                </td>
                <td className="p-1 text-center border-l border-black align-middle" rowSpan={3}>
                  <EditableCell field="dryWet" value={data.dryWet} isEditMode={isEditMode} style={styles.dryWet} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
              
              {/* CONT No. 행 */}
              <tr className="border-b border-black">
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">CONT No.</td>
                <td className="p-1 text-center align-middle" colSpan={2}>
                  <EditableCell field="contNo" value={data.contNo} isEditMode={isEditMode} style={styles.contNo} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
              
              {/* 화물종류 행 */}
              <tr className="border-b border-black">
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">화물종류</td>
                <td className="p-1 text-center align-middle" colSpan={2}>
                  <EditableCell field="화물종류" value={data.화물종류} isEditMode={isEditMode} style={styles.화물종류} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
              
              {/* 수출국명 행 */}
              <tr className="border-b border-black">
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">수출국명</td>
                <td className="w-24 p-1 text-center border-r border-black align-middle">
                  <EditableCell field="수출국명" value={data.수출국명} isEditMode={isEditMode} style={styles.수출국명} onStyleChange={updateFieldStyle} />
                </td>
                <td className="p-1 font-semibold border-r border-black align-middle whitespace-nowrap" style={{width: '60px'}}>선명</td>
                <td className="p-1 text-center align-middle">
                  <EditableCell field="선명" value={data.선명} isEditMode={isEditMode} style={styles.선명} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
              
              {/* 검역사항 행 */}
              <tr className="border-b border-black">
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">검역사항</td>
                <td className="w-24 p-1 text-center border-r border-black align-middle">
                  <EditableCell field="검역사항" value={data.검역사항} isEditMode={isEditMode} style={styles.검역사항} onStyleChange={updateFieldStyle} />
                </td>
                <td className="p-1 font-semibold border-r border-black align-middle whitespace-nowrap" style={{width: '60px'}}>경유지</td>
                <td className="p-1 text-center align-middle">
                  <EditableCell field="경유지" value={data.경유지} isEditMode={isEditMode} style={styles.경유지} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
              
              {/* B/L No. 행 (작은 셀) */}
              <tr className="border-b border-black">
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">B/L No.</td>
                <td className="p-1 text-center align-middle" colSpan={3}>
                  <EditableCell field="blNo" value={data.blNo} isEditMode={isEditMode} style={styles.blNo} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
              
              {/* 화물관리번호 행 */}
              <tr className="border-b border-black">
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">화물관리번호</td>
                <td className="p-1 text-center align-middle" colSpan={3}>
                  <EditableCell field="화물관리번호" value={data.화물관리번호} isEditMode={isEditMode} style={styles.화물관리번호} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
              
              {/* 수입자 행 */}
              <tr className="border-b border-black">
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">수입자</td>
                <td className="p-1 text-center align-middle" colSpan={3}>
                  <EditableCell field="수입자" value={data.수입자} isEditMode={isEditMode} style={styles.수입자} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
              
              {/* 큰 빈 공간 (Costco B/L No. 큰 표시) */}
              <tr className="border-b border-black">
                <td colSpan={4} className="p-12 text-center align-middle" style={{height: '180px'}}>
                  <EditableCell field="costcoBlNo" value={data.costcoBlNo} isEditMode={isEditMode} style={styles.costcoBlNo} onStyleChange={updateFieldStyle} autoResize={true} />
                </td>
              </tr>
              
              {/* 반입일자 행 */}
              <tr className="border-b border-black">
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">반입일자</td>
                <td className="p-1 text-center align-middle" colSpan={3}>
                  <EditableCell field="반입일자" value={data.반입일자} isEditMode={isEditMode} style={styles.반입일자} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
              
              {/* PLT / B/L수량 행 */}
              <tr className="border-b border-black">
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">PLT</td>
                <td className="p-1 text-center border-r border-black align-middle">
                  <EditableCell field="plt" value={data.plt} isEditMode={isEditMode} style={styles.plt} onStyleChange={updateFieldStyle} />
                </td>
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">B/L수량</td>
                <td className="p-1 text-center align-middle">
                  <EditableCell field="bl수량" value={data.bl수량} isEditMode={isEditMode} style={styles.bl수량} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
              
              {/* TIE 행 */}
              <tr className="border-b border-black">
                <td colSpan={2} className="p-1 font-semibold text-center border-r border-black align-middle whitespace-nowrap">TIE</td>
                <td colSpan={2} className="p-1 font-semibold text-center align-middle whitespace-nowrap">SELL UNIT PER CASE</td>
              </tr>
              
              {/* BOX 행 */}
              <tr>
                <td className="w-20 p-1 text-center border-r border-black align-middle">
                  <EditableCell field="tie" value={data.tie} isEditMode={isEditMode} style={styles.tie} onStyleChange={updateFieldStyle} />
                </td>
                <td className="p-1 font-semibold text-center border-r border-black align-middle whitespace-nowrap">BOX</td>
                <td className="w-20 p-1 text-center border-r border-black align-middle">
                  <EditableCell field="sellUnitPerCase" value={data.sellUnitPerCase} isEditMode={isEditMode} style={styles.sellUnitPerCase} onStyleChange={updateFieldStyle} />
                </td>
                <td className="p-1 font-semibold text-center align-middle whitespace-nowrap">EA</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 하단 PALLET 적재정보 */}
        <div className="mt-4 border border-black">
          <div className="text-center font-bold p-1 border-b border-black text-lg">PALLET 적재정보</div>
          <table className="w-full text-lg">
            <tbody>
              {/* 큰 공간 DO, item No. */}
              <tr className="border-b border-black">
                <td colSpan={2} className="p-12 text-center border-r border-black align-middle" style={{width: '50%', height: '180px'}}>
                  <EditableCell field="do" value={data.do} isEditMode={isEditMode} style={styles.do} onStyleChange={updateFieldStyle} autoResize={true} />
                </td>
                <td colSpan={2} className="p-12 text-center align-middle" style={{width: '50%', height: '180px'}}>
                  <EditableCell field="itemNo" value={data.itemNo} isEditMode={isEditMode} style={styles.itemNo} onStyleChange={updateFieldStyle} autoResize={true} />
                </td>
              </tr>
              
              {/* 수량(PCS)/높이 행 */}
              <tr className="border-b border-black">
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">수량(PCS)</td>
                <td className="p-1 text-center border-r border-black align-middle">
                  <EditableCell field="수량Pcs" value={data.수량Pcs} isEditMode={isEditMode} style={styles.수량Pcs} onStyleChange={updateFieldStyle} />
                </td>
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">높이</td>
                <td className="p-1 text-center align-middle">
                  <EditableCell field="높이" value={data.높이} isEditMode={isEditMode} style={styles.높이} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
              
              {/* 소비기한 행 */}
              <tr className="border-b border-black">
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">소비기한</td>
                <td colSpan={3} className="p-1 text-center align-middle">
                  <EditableCell field="소비기한" value={excelDateToString(data.소비기한) === '-' ? '' : excelDateToString(data.소비기한)} isEditMode={isEditMode} style={styles.소비기한} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
              
              {/* 특이사항 행 */}
              <tr>
                <td className="w-20 p-1 font-semibold border-r border-black align-middle whitespace-nowrap">특이사항</td>
                <td colSpan={3} className="p-1 text-center align-middle">
                  <EditableCell field="특이사항" value={data.특이사항 === '-' ? '' : data.특이사항} isEditMode={isEditMode} style={styles.특이사항} onStyleChange={updateFieldStyle} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
