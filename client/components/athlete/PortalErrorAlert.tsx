import { AlertCircle, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface PortalErrorAlertProps {
  error: string | null;
  onRetry?: () => void;
}

export default function PortalErrorAlert({ error, onRetry }: PortalErrorAlertProps) {
  const { t } = useTranslation();
  if (!error) return null;

  return (
    <div
      role="alert"
      className="flex flex-col sm:flex-row sm:items-center gap-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3"
    >
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>{error}</span>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="shrink-0 border-destructive/30 hover:bg-destructive/10"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          {t("common.retry")}
        </Button>
      ) : null}
    </div>
  );
}
