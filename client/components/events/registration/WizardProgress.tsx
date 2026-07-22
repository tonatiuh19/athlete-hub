import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardProgressStep = {
  key: string;
  label: string;
};

interface WizardProgressProps {
  steps: WizardProgressStep[];
  currentIndex: number;
  stepOfLabel: string;
  /** e.g. "Next: Payment" — optional peek at the following step */
  nextStepHint?: string | null;
  className?: string;
}

/**
 * Mobile-first registration progress.
 * Current step title is the hero (never truncated micro-labels on pills).
 * Pills are numbers/checks only; full labels live in the dynamic title.
 */
export default function WizardProgress({
  steps,
  currentIndex,
  stepOfLabel,
  nextStepHint,
  className,
}: WizardProgressProps) {
  const safeIndex = Math.min(Math.max(currentIndex, 0), Math.max(steps.length - 1, 0));
  const current = steps[safeIndex];
  const progressPct =
    steps.length <= 1 ? 100 : Math.round(((safeIndex + 1) / steps.length) * 100);

  return (
    <div className={cn("space-y-3", className)} aria-label={stepOfLabel}>
      <div className="min-w-0 space-y-1">
        <p className="text-[11px] font-medium text-muted-foreground tabular-nums">
          {stepOfLabel}
        </p>
        <p
          key={current?.key ?? safeIndex}
          className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-tight animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
        >
          {current?.label}
        </p>
        {nextStepHint ? (
          <p
            key={`next-${current?.key ?? safeIndex}`}
            className="text-[11px] text-muted-foreground animate-in fade-in-0 duration-300"
          >
            {nextStepHint}
          </p>
        ) : null}
      </div>

      <div
        className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
        role="progressbar"
        aria-valuenow={safeIndex + 1}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuetext={current?.label}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <ol className="flex items-center justify-between gap-1 w-full">
        {steps.map((step, i) => {
          const done = i < safeIndex;
          const active = i === safeIndex;
          return (
            <li key={step.key} className="flex items-center flex-1 min-w-0 last:flex-none">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold border-2 shrink-0 transition-all duration-300",
                  done && "bg-accent border-accent text-accent-foreground scale-95",
                  active &&
                    "bg-primary border-primary text-primary-foreground scale-110 shadow-sm shadow-primary/25",
                  !done && !active && "border-border bg-background text-muted-foreground",
                )}
                aria-current={active ? "step" : undefined}
                aria-label={step.label}
                title={step.label}
              >
                {done ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : i + 1}
              </div>
              {i < steps.length - 1 ? (
                <div
                  className={cn(
                    "h-0.5 flex-1 mx-1 rounded-full transition-colors duration-300",
                    i < safeIndex ? "bg-accent" : "bg-border",
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
