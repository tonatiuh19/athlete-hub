import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  clearStaffError,
  removeStaffAvatar,
  uploadStaffAvatar,
} from "@/store/slices/staffAuthSlice";
import { prepareAvatarDataUrl } from "@/utils/avatarImage";

interface StaffProfileAvatarUploadProps {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
}

export default function StaffProfileAvatarUpload({
  firstName,
  lastName,
  avatarUrl,
}: StaffProfileAvatarUploadProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { role, uploadingAvatar } = useAppSelector((s) => s.staffAuth);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const initials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "S";

  const handleFile = async (file: File | undefined) => {
    if (!file || !role) return;
    setLocalError(null);
    dispatch(clearStaffError());
    setSaved(false);

    try {
      const dataUrl = await prepareAvatarDataUrl(file);
      const result = await dispatch(uploadStaffAvatar({ image: dataUrl, role }));
      if (uploadStaffAvatar.fulfilled.match(result)) {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "failed";
      if (code === "invalid_type") {
        setLocalError(t("staffPortal.profile.avatarErrors.invalidType"));
      } else if (code === "too_large") {
        setLocalError(t("staffPortal.profile.avatarErrors.tooLarge"));
      } else {
        setLocalError(t("staffPortal.profile.avatarErrors.failed"));
      }
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    if (!role) return;
    setLocalError(null);
    dispatch(clearStaffError());
    await dispatch(removeStaffAvatar(role));
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-5">
      <div className="relative group">
        <div className="w-24 h-24 rounded-2xl overflow-hidden bg-cyan/10 border-2 border-cyan/25 flex items-center justify-center">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-primary">{initials}</span>
          )}
        </div>
        {uploadingAvatar ? (
          <div className="absolute inset-0 bg-background/70 rounded-2xl flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 text-center sm:text-left">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploadingAvatar}
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="w-4 h-4 mr-2" />
            {t("staffPortal.profile.changePhoto")}
          </Button>
          {avatarUrl ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={uploadingAvatar}
              onClick={handleRemove}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t("staffPortal.profile.removePhoto")}
            </Button>
          ) : null}
        </div>
        {saved ? (
          <p className="text-xs text-primary">{t("staffPortal.profile.photoSaved")}</p>
        ) : null}
        {localError ? <p className="text-xs text-destructive">{localError}</p> : null}
      </div>
    </div>
  );
}
