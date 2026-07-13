import { useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Circle, PartyPopper } from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store/hooks";
import { dismissOrganizerOnboarding } from "@/utils/organizerOnboardingStorage";

export default function StaffOnboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, role } = useAppSelector((s) => s.staffAuth);

  if (role === "admin") {
    return <Navigate to="/staff" replace />;
  }

  const displayName =
    user?.type === "organizer" ? user.firstName : t("organizerSignup.onboarding.fallbackName");

  const checklist = [
    t("organizerSignup.onboarding.checklistDraft"),
    t("organizerSignup.onboarding.checklistCategories"),
    t("organizerSignup.onboarding.checklistSubmit"),
  ];

  const goToCreateEvent = () => {
    dismissOrganizerOnboarding();
    navigate("/staff/events/new");
  };

  const goToDashboard = () => {
    dismissOrganizerOnboarding();
    navigate("/staff");
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 animate-slide-up">
      <MetaHelmet
        title={t("organizerSignup.onboarding.metaTitle")}
        description={t("organizerSignup.onboarding.metaDescription")}
        path="/staff/onboarding"
        noindex
      />

      <div className="rounded-2xl border border-border bg-card/60 p-6 md:p-8 space-y-6">
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-primary/10 p-3">
            <PartyPopper className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-2">
              {t("organizerSignup.onboarding.title", { name: displayName })}
            </h1>
            <p className="text-muted-foreground">{t("organizerSignup.onboarding.subtitle")}</p>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-background/60 p-4">
          <p className="text-sm font-medium">{t("organizerSignup.onboarding.checklistTitle")}</p>
          <ul className="space-y-2">
            {checklist.map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Circle className="w-4 h-4 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 flex gap-3">
          <CheckCircle2 className="w-5 h-5 text-accent shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            {t("organizerSignup.onboarding.reviewNote")}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button size="lg" className="h-12 flex-1" onClick={goToCreateEvent}>
            {t("organizerSignup.onboarding.createEvent")}
          </Button>
          <Button size="lg" variant="outline" className="h-12 flex-1" onClick={goToDashboard}>
            {t("organizerSignup.onboarding.exploreDashboard")}
          </Button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          {t("organizerSignup.helpPrompt")}{" "}
          <a href="mailto:soporte@triboosport.com" className="text-primary hover:underline">
            {t("organizerSignup.helpEmail")}
          </a>
        </p>
      </div>
    </div>
  );
}
