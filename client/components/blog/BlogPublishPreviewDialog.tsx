import { useTranslation } from "react-i18next";
import { Eye, Loader2 } from "lucide-react";
import BlogArticlePreview, {
  type BlogArticlePreviewProps,
} from "@/components/blog/BlogArticlePreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface BlogPublishPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "preview" | "publish";
  article: BlogArticlePreviewProps;
  onConfirm?: () => void;
  confirming?: boolean;
}

export default function BlogPublishPreviewDialog({
  open,
  onOpenChange,
  mode,
  article,
  onConfirm,
  confirming = false,
}: BlogPublishPreviewDialogProps) {
  const { t } = useTranslation();
  const isPublish = mode === "publish";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            {isPublish
              ? t("staffPortal.blog.preview.publishTitle")
              : t("staffPortal.blog.preview.title")}
          </DialogTitle>
          <DialogDescription>
            {isPublish
              ? t("staffPortal.blog.preview.publishDescription")
              : t("staffPortal.blog.preview.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0">
          <BlogArticlePreview {...article} compact />
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border shrink-0 gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={confirming}
            onClick={() => onOpenChange(false)}
          >
            {t("staffPortal.blog.actions.cancel")}
          </Button>
          {isPublish ? (
            <Button
              type="button"
              className="btn-primary"
              disabled={confirming}
              onClick={onConfirm}
            >
              {confirming ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {t("staffPortal.blog.preview.confirmPublish")}
            </Button>
          ) : (
            <Button type="button" className="btn-primary" onClick={() => onOpenChange(false)}>
              {t("staffPortal.blog.preview.close")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
