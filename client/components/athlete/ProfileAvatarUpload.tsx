import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  removeAthleteAvatar,
  uploadAthleteAvatar,
  clearAthleteError,
} from "@/store/slices/athleteAuthSlice";
import { prepareAvatarDataUrl } from "@/utils/avatarImage";

interface ProfileAvatarUploadProps {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

export default function ProfileAvatarUpload({
  firstName,
  lastName,
  avatarUrl,
}: ProfileAvatarUploadProps) {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { uploadingAvatar } = useAppSelector((s) => s.athleteAuth);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const initials =
    `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "A";

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setLocalError(null);
    dispatch(clearAthleteError());
    setSaved(false);

    try {
      const dataUrl = await prepareAvatarDataUrl(file);
      const result = await dispatch(uploadAthleteAvatar({ image: dataUrl }));
      if (uploadAthleteAvatar.fulfilled.match(result)) {
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2500);
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "failed";
      if (code === "invalid_type") {
        setLocalError(t("athletePortal.profile.avatarErrors.invalidType"));
      } else if (code === "too_large") {
        setLocalError(t("athletePortal.profile.avatarErrors.tooLarge"));
      } else {
        setLocalError(t("athletePortal.profile.avatarErrors.failed"));
      }
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    setLocalError(null);
    dispatch(clearAthleteError());
    const result = await dispatch(removeAthleteAvatar());
    if (removeAthleteAvatar.fulfilled.match(result)) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="relative shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="w-20 h-20 rounded-2xl object-cover border border-cyan/20"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-cyan to-blue-electric flex items-center justify-center text-2xl font-bold text-navy-deep">
            {initials}
          </div>
        )}
        {uploadingAvatar ? (
          <div className="absolute inset-0 rounded-2xl bg-background/70 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-cyan" />
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-2 text-center sm:text-left">
        <p className="text-sm font-medium">{t("athletePortal.profile.avatarLabel")}</p>
        <p className="text-xs text-muted-foreground">{t("athletePortal.profile.avatarHint")}</p>
        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={uploadingAvatar}
            onClick={() => inputRef.current?.click()}
            className="border-cyan/30"
          >
            <Camera className="w-3.5 h-3.5 mr-1.5" />
            {uploadingAvatar
              ? t("athletePortal.profile.avatarUploading")
              : t("athletePortal.profile.avatarUpload")}
          </Button>
          {avatarUrl ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={uploadingAvatar}
              onClick={() => void handleRemove()}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              {t("athletePortal.profile.avatarRemove")}
            </Button>
          ) : null}
        </div>
        {localError ? (
          <p className="text-xs text-destructive">{localError}</p>
        ) : null}
        {saved ? (
          <p className="text-xs text-cyan">{t("athletePortal.profile.avatarSaved")}</p>
        ) : null}
      </div>
    </div>
  );
}
