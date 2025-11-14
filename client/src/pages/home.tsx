import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CargoSearchForm } from "@/components/cargo-search-form";
import { CargoResults } from "@/components/cargo-results";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { type BatchCargoResult, type FormTemplate } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { BatchPrint } from "@/components/batch-print";

export default function Home() {
  const [results, setResults] = useState<BatchCargoResult[] | null>(null);
  const [showBatchPrint, setShowBatchPrint] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // 마운트 시 sessionStorage에서 복원
  useEffect(() => {
    const saved = sessionStorage.getItem('cargo-search-results');
    if (saved) {
      setResults(JSON.parse(saved));
    }
  }, []);

  // 헤더의 일괄 인쇄 버튼 클릭 이벤트 리스닝
  useEffect(() => {
    const handleBatchPrintEvent = () => {
      handleBatchPrint();
    };
    
    window.addEventListener('open-batch-print', handleBatchPrintEvent);
    return () => window.removeEventListener('open-batch-print', handleBatchPrintEvent);
  }, []);

  // beforeunload로 새로고침/닫기 시 sessionStorage 삭제
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.removeItem('cargo-search-results');
      sessionStorage.removeItem('cargo-selected-bls');
      sessionStorage.removeItem('cargo-selected-items');
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const { data: templates } = useQuery<FormTemplate[]>({
    queryKey: ["/api/form-templates"],
  });

  // 템플릿이 로드되면 첫 번째 템플릿을 기본값으로 설정
  useEffect(() => {
    if (templates && templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id.toString());
    }
  }, [templates, selectedTemplateId]);

  // 검색 결과가 변경되면 sessionStorage에 저장
  useEffect(() => {
    if (results) {
      sessionStorage.setItem('cargo-search-results', JSON.stringify(results));
    } else {
      sessionStorage.removeItem('cargo-search-results');
    }
  }, [results]);

  const searchMutation = useMutation({
    mutationFn: async (data: { selectedItemIds: number[] }) => {
      const response = await apiRequest(
        "POST",
        "/api/inbound/manifests-batch",
        { itemIds: data.selectedItemIds }
      );
      return await response.json() as BatchCargoResult[];
    },
    onSuccess: (data) => {
      setResults(data);
    },
  });

  const handleSearch = (data: { selectedItemIds: number[] }) => {
    setResults(null);
    searchMutation.mutate(data);
  };

  const handleBatchPrint = () => {
    setShowBatchPrint(true);
  };

  // 일괄 인쇄용 데이터 준비 - 선택된 템플릿 사용
  const batchPrintData = results && templates && templates.length > 0
    ? (() => {
        const selectedTemplate = templates.find(t => t.id.toString() === selectedTemplateId) || templates[0];
        return results
          .filter(r => r.manifest)
          .map(r => ({
            data: r.manifest!,
            template: selectedTemplate,
          }));
      })()
    : [];

  // 일괄 인쇄 모드일 때
  if (showBatchPrint && batchPrintData.length > 0) {
    return (
      <BatchPrint 
        results={batchPrintData}
        onClose={() => setShowBatchPrint(false)}
      />
    );
  }

  return (
    <div className="h-full flex gap-6 p-6 overflow-hidden">
      {/* 왼쪽: 검색 폼 - 고정 */}
      <div className="w-[400px] flex-shrink-0">
        <Card className="overflow-hidden">
          <CargoSearchForm 
            onSubmit={handleSearch} 
            isLoading={searchMutation.isPending}
          />
        </Card>
      </div>

      {/* 오른쪽: 모든 검색 결과 상세 정보 */}
      <div className="flex-1 min-w-0 h-full">
        {searchMutation.isPending && (
          <Card className="p-6">
            <LoadingState />
          </Card>
        )}
        
        {searchMutation.isError && (
          <Card className="p-6">
            <ErrorState error={searchMutation.error as Error} />
          </Card>
        )}
        
        {results && !searchMutation.isPending && (
          <Card className="h-full flex flex-col overflow-hidden">
            <CargoResults 
              data={results}
              templates={templates}
              selectedTemplateId={selectedTemplateId}
              onTemplateChange={setSelectedTemplateId}
            />
          </Card>
        )}

        {!results && !searchMutation.isPending && !searchMutation.isError && (
          <Card className="p-6">
            <p className="text-muted-foreground text-center">
              B/L과 Item No.를 선택하여 화물을 조회하세요.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
