import { useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Shield,
  Users,
} from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchPublicSiteProfile } from "@/store/slices/publicSiteSlice";
import { LEGAL_ROUTES, legalFieldDisplay } from "@shared/siteLegal";

export default function ContactPage() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { profile } = useAppSelector((s) => s.publicSite);
  const { legalEntity: le, contact: cp } = profile;

  useEffect(() => {
    dispatch(fetchPublicSiteProfile());
  }, [dispatch]);

  const supportEmail = legalFieldDisplay(le.supportEmail);
  const arcoEmail = legalFieldDisplay(le.arcoEmail);
  const phone = legalFieldDisplay(le.phone);
  const whatsapp = legalFieldDisplay(le.whatsapp);
  const address = legalFieldDisplay(le.address);
  const legalName = legalFieldDisplay(le.legalName);
  const officeHours = legalFieldDisplay(cp.officeHours);
  const responseTime = legalFieldDisplay(cp.responseTime);

  const socialLinks = useMemo(
    () =>
      [
        { label: "Instagram", url: legalFieldDisplay(cp.socialInstagram) },
        { label: "Facebook", url: legalFieldDisplay(cp.socialFacebook) },
        { label: "YouTube", url: legalFieldDisplay(cp.socialYoutube) },
      ].filter((s) => s.url),
    [cp.socialFacebook, cp.socialInstagram, cp.socialYoutube],
  );

  const headline = legalFieldDisplay(cp.headline) ?? t("contact.defaultHeadline");
  const subtitle = legalFieldDisplay(cp.subtitle) ?? t("contact.defaultSubtitle");

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-gradient-dark">
      <MetaHelmet
        title={t("contact.metaTitle")}
        description={t("contact.metaDescription")}
        path="/contact"
      />

      <div className="max-w-5xl mx-auto px-4 py-10 md:py-16">
        <div className="text-center max-w-2xl mx-auto mb-10 md:mb-14 animate-slide-up">
          <p className="text-xs uppercase tracking-[0.2em] text-primary font-semibold mb-3">
            {t("contact.eyebrow")}
          </p>
          <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4">{headline}</h1>
          <p className="text-muted-foreground text-base md:text-lg leading-relaxed">{subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 animate-slide-up">
            {supportEmail ? (
              <a href={`mailto:${supportEmail}`} className="block h-full">
                <div className="rounded-2xl border border-border bg-card/60 p-5 md:p-6 h-full transition-all hover:border-primary/40 hover:bg-card/80">
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-primary/10 p-3 shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <h3 className="font-semibold">{t("contact.cards.supportTitle")}</h3>
                      <p className="text-sm text-muted-foreground">
                        {legalFieldDisplay(cp.supportHint) ?? t("contact.cards.supportBody")}
                      </p>
                      <p className="text-sm font-medium text-primary">{supportEmail}</p>
                    </div>
                  </div>
                </div>
              </a>
            ) : null}

            {arcoEmail ? (
              <a href={`mailto:${arcoEmail}`} className="block h-full">
                <div className="rounded-2xl border border-border bg-card/60 p-5 md:p-6 h-full transition-all hover:border-primary/40 hover:bg-card/80">
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-primary/10 p-3 shrink-0">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <h3 className="font-semibold">{t("contact.cards.privacyTitle")}</h3>
                      <p className="text-sm text-muted-foreground">{t("contact.cards.privacyBody")}</p>
                      <p className="text-sm font-medium text-primary">{arcoEmail}</p>
                    </div>
                  </div>
                </div>
              </a>
            ) : null}

            {phone ? (
              <a href={`tel:${phone}`} className="block h-full">
                <div className="rounded-2xl border border-border bg-card/60 p-5 md:p-6 h-full transition-all hover:border-primary/40 hover:bg-card/80">
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-primary/10 p-3 shrink-0">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <h3 className="font-semibold">{t("contact.cards.phoneTitle")}</h3>
                      <p className="text-sm font-medium text-primary">{phone}</p>
                    </div>
                  </div>
                </div>
              </a>
            ) : null}

            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-full"
              >
                <div className="rounded-2xl border border-border bg-card/60 p-5 md:p-6 h-full transition-all hover:border-primary/40 hover:bg-card/80">
                  <div className="flex items-start gap-4">
                    <div className="rounded-xl bg-primary/10 p-3 shrink-0">
                      <MessageCircle className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0 space-y-2">
                      <h3 className="font-semibold">{t("contact.cards.whatsappTitle")}</h3>
                      <p className="text-sm text-muted-foreground">{t("contact.cards.whatsappBody")}</p>
                    </div>
                  </div>
                </div>
              </a>
            ) : null}

            {address ? (
              <div className="rounded-2xl border border-border bg-card/60 p-5 md:p-6 h-full">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-primary/10 p-3 shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <h3 className="font-semibold">{t("contact.cards.addressTitle")}</h3>
                    <p className="text-sm font-medium text-foreground">{address}</p>
                    {legalName ? <p className="text-xs text-muted-foreground">{legalName}</p> : null}
                  </div>
                </div>
              </div>
            ) : null}

            <Link to="/organizers/start" className="block h-full">
              <div className="rounded-2xl border border-border bg-card/60 p-5 md:p-6 h-full transition-all hover:border-primary/40 hover:bg-card/80">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl bg-primary/10 p-3 shrink-0">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <h3 className="font-semibold">{t("contact.cards.organizersTitle")}</h3>
                    <p className="text-sm text-muted-foreground">
                      {legalFieldDisplay(cp.organizerHint) ?? t("contact.cards.organizersBody")}
                    </p>
                    <span className="inline-flex items-center text-sm text-primary font-medium">
                      {t("contact.cards.organizersCta")}
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </span>
                  </div>
                </div>
              </div>
            </Link>
        </div>

        {(responseTime || officeHours) && (
          <div className="mt-8 rounded-2xl border border-border bg-card/40 p-5 md:p-6 flex flex-col sm:flex-row gap-4 sm:gap-8 justify-center text-sm text-muted-foreground">
            {responseTime ? (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <span>{responseTime}</span>
              </div>
            ) : null}
            {officeHours ? (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <span>{officeHours}</span>
              </div>
            ) : null}
          </div>
        )}

        {socialLinks.length > 0 ? (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {socialLinks.map((s) => (
              <Button key={s.label} asChild variant="outline" size="sm" className="rounded-full">
                <a href={s.url!} target="_blank" rel="noopener noreferrer">
                  {s.label}
                </a>
              </Button>
            ))}
          </div>
        ) : null}

        <div className="mt-12 rounded-2xl border border-border/60 bg-card/30 p-6 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("contact.faqHint")}{" "}
            <Link to="/help" className="text-primary font-medium hover:underline">
              {t("contact.faqLink")}
            </Link>
          </p>
          <p className="text-sm text-muted-foreground">{t("contact.legalHint")}</p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <Link to={LEGAL_ROUTES.privacy} className="text-primary hover:underline">
              {t("legal.links.privacy")}
            </Link>
            <Link to={LEGAL_ROUTES.terms} className="text-primary hover:underline">
              {t("legal.links.terms")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
