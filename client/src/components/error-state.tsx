import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ErrorStateProps {
  error: Error;
}

export function ErrorState({ error }: ErrorStateProps) {
  return (
    <div className="p-6" data-testid="error-state">
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>조회 실패</AlertTitle>
        <AlertDescription className="whitespace-pre-wrap">
          {error.message}
        </AlertDescription>
      </Alert>
    </div>
  );
}
