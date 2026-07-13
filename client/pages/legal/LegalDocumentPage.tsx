import { useEffect, useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchPublicSiteProfile } from "@/store/slices/publicSiteSlice";
import {
  getLegalDocumentHtml,
  getLegalDocumentTitle,
  isLegalDocumentId,
} from "@/utils/legalContent";

export default function LegalDocumentPage() {
  const { documentId = "" } = useParams<{ documentId: string }>();
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const { profile } = useAppSelector((s) => s.publicSite);

  useEffect(() => {
    dispatch(fetchPublicSiteProfile());
  }, [dispatch]);

  if (!isLegalDocumentId(documentId)) {
    return <Navigate to="/" replace />;
  }

  const title = useMemo(
    () => getLegalDocumentTitle(documentId, i18n.language, profile.legalEntity),
    [documentId, i18n.language, profile.legalEntity],
  );

  const html = useMemo(
    () => getLegalDocumentHtml(documentId, i18n.language, profile.legalEntity),
    [documentId, i18n.language, profile.legalEntity],
  );

  return (
    <div className="min-h-[calc(100vh-4.5rem)] bg-gradient-dark">
      <MetaHelmet
        title={`${title} — ${t("common.appName")}`}
        description={t("legal.pageDescription")}
        path={`/legal/${documentId}`}
      />

      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12">
        <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground">
          <Link to="/">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("legal.backHome")}
          </Link>
        </Button>

        <article
          className="legal-prose rounded-2xl border border-border bg-card/60 p-6 md:p-10"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
