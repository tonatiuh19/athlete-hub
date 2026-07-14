import { useCallback, useMemo, useState } from "react";
import { Check, Copy, Link2, Share2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AVATAR_TONES = [
  "bg-primary text-primary-foreground",
  "bg-accent text-accent-foreground",
  "bg-secondary text-secondary-foreground",
  "bg-muted text-foreground border border-border",
] as const;

interface RegistrationInviteFriendsCardProps {
  eventTitle: string;
  eventSlug: string;
  className?: string;
}

export default function RegistrationInviteFriendsCard({
  eventTitle,
  eventSlug,
  className,
}: RegistrationInviteFriendsCardProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const eventUrl = useMemo(() => {
    if (!eventSlug || typeof window === "undefined") return "";
    return `${window.location.origin}/events/${eventSlug}`;
  }, [eventSlug]);

  const shareText = t("registrationWizard.result.invite.shareText", {
    event: eventTitle,
  });
  const shareTitle = t("registrationWizard.result.invite.shareTitle", {
    event: eventTitle,
  });

  const copyLink = useCallback(async () => {
    if (!eventUrl) return;
    try {
      await navigator.clipboard.writeText(`${shareText}\n${eventUrl}`);
      setCopied(true);
      toast.success(t("registrationWizard.result.invite.linkCopied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("registrationWizard.result.invite.linkCopyFailed"));
    }
  }, [eventUrl, shareText, t]);

  const shareInvite = useCallback(async () => {
    if (!eventUrl) return;

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: eventUrl,
        });
        return;
      } catch {
        /* user canceled or share unavailable — fall through */
      }
    }

    await copyLink();
  }, [copyLink, eventUrl, shareText, shareTitle]);

  const openWhatsApp = useCallback(() => {
    if (!eventUrl) return;
    const payload = encodeURIComponent(`${shareText}\n${eventUrl}`);
    window.open(`https://wa.me/?text=${payload}`, "_blank", "noopener,noreferrer");
  }, [eventUrl, shareText]);

  if (!eventSlug) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-primary/25 text-left",
        "bg-gradient-to-br from-primary/12 via-card to-accent/10",
        "animate-in fade-in slide-in-from-bottom-2 duration-500",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-2xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 -left-8 h-28 w-28 rounded-full bg-accent/15 blur-2xl"
        aria-hidden
      />

      <div className="relative space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/15">
            <Users className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">
              {t("registrationWizard.result.invite.eyebrow")}
            </p>
            <h4 className="mt-0.5 text-base font-bold text-foreground leading-snug">
              {t("registrationWizard.result.invite.title")}
            </h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {t("registrationWizard.result.invite.subtitle", { event: eventTitle })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex -space-x-2" aria-hidden>
            {AVATAR_TONES.map((tone, i) => (
              <div
                key={tone}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 border-card text-[10px] font-bold shadow-sm",
                  tone,
                )}
              >
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
          <p className="text-[11px] font-medium text-muted-foreground">
            {t("registrationWizard.result.invite.crewHint")}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5">
          <Link2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <p className="min-w-0 flex-1 truncate text-[11px] font-mono text-muted-foreground">
            {eventUrl.replace(/^https?:\/\//, "")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            type="button"
            onClick={() => void shareInvite()}
            className="h-11 rounded-xl bg-triboo-gradient text-primary-foreground font-bold shadow-glow-triboo hover:brightness-110 sm:col-span-1"
          >
            <Share2 className="mr-2 h-4 w-4" />
            {t("registrationWizard.result.invite.share")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void copyLink()}
            className="h-11 rounded-xl border-border bg-card/80"
          >
            {copied ? (
              <Check className="mr-2 h-4 w-4 text-accent" />
            ) : (
              <Copy className="mr-2 h-4 w-4" />
            )}
            {copied
              ? t("registrationWizard.result.invite.copied")
              : t("registrationWizard.result.invite.copyLink")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={openWhatsApp}
            className="h-11 rounded-xl border-accent/35 bg-accent/10 text-foreground hover:bg-accent/15"
          >
            {t("registrationWizard.result.invite.whatsapp")}
          </Button>
        </div>
      </div>
    </div>
  );
}
