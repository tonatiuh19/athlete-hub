import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Footprints, Loader2, ShieldCheck } from "lucide-react";
import TribooLogo from "@/components/brand/TribooLogo";
import { cn } from "@/lib/utils";

const QUOTE_COUNT = 6;
const QUOTE_ROTATE_MS = 4_500;

export type AuthFlowLoadingStep = "verify" | "sync" | "ready";

interface AuthFlowLoadingPanelProps {
  statusMessage: string;
  step: AuthFlowLoadingStep;
  className?: string;
}

export default function AuthFlowLoadingPanel({
  statusMessage,
  step,
  className,
}: AuthFlowLoadingPanelProps) {
  const { t } = useTranslation();
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [quoteVisible, setQuoteVisible] = useState(true);

  const quotes = useMemo(
    () =>
      Array.from({ length: QUOTE_COUNT }, (_, i) =>
        t(`auth.sso.quotes.${i + 1}`),
      ),
    [t],
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setQuoteVisible(false);
      window.setTimeout(() => {
        setQuoteIndex((i) => (i + 1) % QUOTE_COUNT);
        setQuoteVisible(true);
      }, 280);
    }, QUOTE_ROTATE_MS);
    return () => clearInterval(interval);
  }, []);

  const steps: { id: AuthFlowLoadingStep; label: string }[] = [
    { id: "verify", label: t("auth.sso.steps.verify") },
    { id: "sync", label: t("auth.sso.steps.link") },
    { id: "ready", label: t("auth.sso.steps.ready") },
  ];

  const stepOrder: AuthFlowLoadingStep[] = ["verify", "sync", "ready"];
  const activeIndex = stepOrder.indexOf(step);

  return (
    <div
      className={cn(
        "min-h-screen w-full flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[min(100%,28rem)] h-72 rounded-full bg-cyan/10 blur-3xl animate-blob"
        aria-hidden
      />

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xl shadow-xl overflow-hidden">
          <div className="h-1 w-full bg-muted/40">
            <div
              className="h-full bg-gradient-to-r from-cyan to-accent transition-all duration-700 ease-out"
              style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }}
            />
          </div>

          <div className="p-6 sm:p-8 flex flex-col items-center text-center gap-6">
            <div className="relative">
              <div
                className="absolute inset-0 rounded-full bg-cyan/20 animate-ping"
                aria-hidden
              />
              <div className="relative w-16 h-16 rounded-full border border-cyan/30 bg-cyan/5 flex items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-cyan" />
              </div>
            </div>

            <TribooLogo surface="dark" className="h-9" />

            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-foreground">{statusMessage}</p>
              <p className="text-xs text-muted-foreground">{t("auth.sso.completingHint")}</p>
            </div>

            <div className="flex items-center gap-2 w-full max-w-xs">
              {steps.map((s, i) => {
                const done = i < activeIndex;
                const active = i === activeIndex;
                return (
                  <div key={s.id} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                    <div
                      className={cn(
                        "w-full h-1.5 rounded-full transition-colors duration-500",
                        done && "bg-accent",
                        active && "bg-cyan",
                        !done && !active && "bg-muted",
                      )}
                    />
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-wide truncate w-full text-center",
                        active ? "text-cyan font-semibold" : "text-muted-foreground",
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              className={cn(
                "w-full rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 flex gap-3 text-left transition-opacity duration-300",
                quoteVisible ? "opacity-100" : "opacity-0",
              )}
            >
              <Footprints className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/90 leading-relaxed italic">
                &ldquo;{quotes[quoteIndex]}&rdquo;
              </p>
            </div>

            <div className="w-full flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3.5 py-2.5 text-left">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("auth.sso.doNotRefresh")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
