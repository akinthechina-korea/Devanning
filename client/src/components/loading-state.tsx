import { Loader2 } from "lucide-react";

export function LoadingState() {
  return (
    <div className="p-6 text-center" data-testid="loading-state">
      <div className="flex justify-center items-center gap-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <span className="text-lg font-medium">데이터를 조회하는 중입니다...</span>
      </div>
    </div>
  );
}
