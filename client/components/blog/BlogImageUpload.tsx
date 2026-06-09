import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validateBlogImageFile } from "@/utils/blogImageValidation";
import { cn } from "@/lib/utils";

export interface BlogImageUploadProps {
  /** Local blob URL or existing CDN URL for display only */
  previewUrl: string | null;
  onSelectFile: (file: File) => void;
  onClear: () => void;
  className?: string;
}

export default function BlogImageUpload({
  previewUrl,
  onSelectFile,
  onClear,
  className,
}: BlogImageUploadProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    const validationError = validateBlogImageFile(file, t);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSelectFile(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div
        className={cn(
          "relative rounded-xl border border-dashed border-border bg-secondary/30 overflow-hidden",
          previewUrl ? "border-solid" : "min-h-[180px]",
        )}
      >
        {previewUrl ? (
          <>
            <img src={previewUrl} alt="" className="w-full h-48 sm:h-56 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none" />
            <span className="absolute top-3 right-3 px-2 py-1 rounded-full bg-background/80 backdrop-blur text-[10px] font-bold uppercase tracking-wider text-primary border border-primary/30">
              {t("staffPortal.blog.coverPreviewBadge")}
            </span>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground max-w-xs">
              {t("staffPortal.blog.coverHint")}
            </p>
          </div>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">{t("staffPortal.blog.coverUploadOnSave")}</p>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="border-primary/30 hover:border-primary hover:bg-primary/10"
        >
          <Upload className="w-4 h-4 mr-2" />
          {previewUrl ? t("staffPortal.blog.coverReplace") : t("staffPortal.blog.coverUpload")}
        </Button>
        {previewUrl ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {t("staffPortal.blog.coverRemove")}
          </Button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
}
