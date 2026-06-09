import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { CalendarCheck } from "lucide-react";
import AthleteProfileCompletionForm from "@/components/auth/AthleteProfileCompletionForm";
import { useAppSelector } from "@/store/hooks";
import { athleteNeedsProfileCompletion } from "@/utils/athleteProfileCompletion";
import { registrationReturnPathAfterProfile } from "@/utils/registrationSessionStorage";

export default function CompleteProfile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAppSelector((s) => s.athleteAuth);

  useEffect(() => {
    if (user && !athleteNeedsProfileCompletion(user)) {
      navigate(registrationReturnPathAfterProfile() ?? "/portal", { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="max-w-lg mx-auto py-8 md:py-12 px-4">
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 md:p-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {t("athletePortal.completeProfile.title")}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("athletePortal.completeProfile.subtitle")}
            </p>
          </div>
        </div>
        <AthleteProfileCompletionForm
          onComplete={() =>
            navigate(registrationReturnPathAfterProfile() ?? "/portal", { replace: true })
          }
        />
      </div>
    </div>
  );
}
