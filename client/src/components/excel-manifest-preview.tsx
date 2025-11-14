import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer, FileSpreadsheet } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface ExcelCell {
  value: string;
  rowSpan?: number;
  colSpan?: number;
  style?: {
    backgroundColor?: string;
    color?: string;
    fontWeight?: string;
    fontSize?: string;
    textAlign?: string;
    verticalAlign?: string;
    border?: string;
  };
}

interface ExcelRow {
  cells: (ExcelCell | null)[];
}

interface ExcelData {
  rows: ExcelRow[];
}

export function ExcelManifestPreview() {
  const manifestRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const { toast } = useToast();

  const { data: excelData, isLoading, error } = useQuery<ExcelData>({
    queryKey: ['/api/excel-manifest'],
  });

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

      const fileName = `엑셀양식_${new Date().toISOString().split('T')[0]}.pdf`;
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

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <FileSpreadsheet className="w-8 h-8 animate-pulse mr-2" />
          <span>엑셀 양식 로딩 중...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-8">
        <div className="text-red-600">
          엑셀 양식 로딩 실패: {error instanceof Error ? error.message : '알 수 없는 오류'}
        </div>
      </Card>
    );
  }

  if (!excelData) {
    return null;
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 print:hidden">
        <Button 
          onClick={handleDownloadPDF} 
          variant="default" 
          size="default"
          disabled={isGeneratingPDF}
          data-testid="button-download-excel-pdf"
        >
          <Download className="w-4 h-4 mr-2" />
          {isGeneratingPDF ? "PDF 생성 중..." : "PDF 다운로드"}
        </Button>
        <Button 
          onClick={handlePrint} 
          variant="outline" 
          size="default"
          data-testid="button-print-excel"
        >
          <Printer className="w-4 h-4 mr-2" />
          인쇄하기
        </Button>
      </div>

      <Card ref={manifestRef} className="p-8 bg-white text-black print:shadow-none" data-testid="excel-manifest-preview">
        <table className="w-full border-collapse" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {excelData.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.cells.map((cell, cellIndex) => {
                  if (!cell) return null;
                  
                  const style = {
                    padding: '8px',
                    ...cell.style,
                  } as React.CSSProperties;

                  return (
                    <td
                      key={cellIndex}
                      rowSpan={cell.rowSpan}
                      colSpan={cell.colSpan}
                      style={style}
                    >
                      {cell.value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
