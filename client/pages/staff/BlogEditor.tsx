import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFormik } from "formik";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Check,
  Eye,
  ExternalLink,
  Loader2,
  Save,
  Sparkles,
} from "lucide-react";
import MetaHelmet from "@/components/MetaHelmet";
import PortalErrorAlert from "@/components/athlete/PortalErrorAlert";
import BlogImageUpload from "@/components/blog/BlogImageUpload";
import BlogPublishPreviewDialog from "@/components/blog/BlogPublishPreviewDialog";
import RichHtmlEditor from "@/components/blog/RichHtmlEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  checkBlogSlug,
  clearStaffBlogPost,
  createStaffBlogPost,
  fetchStaffBlogPost,
  updateStaffBlogPost,
} from "@/store/slices/blogsSlice";
import {
  fetchAdminEvents,
  fetchAdminOrganizers,
  fetchOrganizerEvents,
} from "@/store/slices/staffPortalSlice";
import {
  createBlobPreviewUrl,
  revokeBlobUrl,
  uploadPendingBlogImages,
} from "@/lib/blog-pending-images";
import { validateBlogImageFile } from "@/utils/blogImageValidation";
import {
  createBlogEditorSchema,
  type BlogEditorFormValues,
} from "@/utils/blogEditorSchema";
import { normalizeBlogSlug, resolveBlogSlug, slugify } from "@shared/slugify";
import { normalizeBlogLocale } from "@/utils/blogOrigin";
import type { BlogPostStaff, BlogPostStatus, BlogUpsertRequest } from "@shared/api";
import { cn } from "@/lib/utils";

const EMPTY_FORM: BlogEditorFormValues = {
  title: "",
  slug: "",
  excerpt: "",
  bodyHtml: "",
  coverImageUrl: null,
  seoTitle: "",
  seoDescription: "",
  ogImageUrl: null,
  status: "draft",
  featured: false,
    eventId: null,
  organizerId: null as number | null,
  locale: "es",
};

function postToForm(post: BlogPostStaff): BlogEditorFormValues {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt || "",
    bodyHtml: post.bodyHtml || "",
    coverImageUrl: post.coverImageUrl,
    seoTitle: post.seoTitle || "",
    seoDescription: post.seoDescription || "",
    ogImageUrl: post.ogImageUrl,
    status: post.status,
    featured: post.featured,
    eventId: post.eventId,
    organizerId: post.organizerId,
    locale: (post.locale?.startsWith("en") ? "en" : "es") as "es" | "en",
  };
}

function buildPayload(
  values: BlogEditorFormValues,
  status?: BlogPostStatus,
  isAdmin?: boolean,
): BlogUpsertRequest {
  const slug = resolveBlogSlug(values.title, values.slug);
  const organizerId = isAdmin ? values.organizerId : undefined;
  return {
    title: values.title.trim(),
    slug,
    excerpt: values.excerpt.trim() || null,
    bodyHtml: values.bodyHtml || null,
    coverImageUrl: values.coverImageUrl,
    seoTitle: values.seoTitle.trim() || null,
    seoDescription: values.seoDescription.trim() || null,
    ogImageUrl: values.ogImageUrl || values.coverImageUrl,
    status: status ?? values.status,
    featured: values.featured,
    eventId: values.eventId,
    organizerId,
    scope: isAdmin ? (organizerId ? "organizer" : "platform") : undefined,
    locale: values.locale,
  };
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export default function BlogEditor() {
  const { postId } = useParams<{ postId: string }>();
  const isNew = postId === "new" || !postId;
  const numericId =
    !isNew && postId && /^\d+$/.test(postId) ? Number(postId) : null;
  const invalidId = !isNew && numericId == null;

  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { role } = useAppSelector((s) => s.staffAuth);
  const { staffPost, staffPostLoading, staffPostError, saving, saveError } =
    useAppSelector((s) => s.blogs);
  const staffEvents = useAppSelector((s) => s.staffPortal.events);
  const adminOrganizers = useAppSelector((s) => s.staffPortal.adminOrganizers);

  const [slugEdited, setSlugEdited] = useState(false);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverPendingFile, setCoverPendingFile] = useState<File | null>(null);
  const [coverSavedUrl, setCoverSavedUrl] = useState<string | null>(null);
  const bodyPendingByUrlRef = useRef(new Map<string, File>());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<"preview" | "publish">("preview");
  const [uploadingImages, setUploadingImages] = useState(false);
  const [slugCheck, setSlugCheck] = useState<{
    available: boolean;
    suggestion?: string;
    checking: boolean;
  }>({ available: true, checking: false });
  const loadedPostIdRef = useRef<number | null>(null);

  const isAdmin = role === "admin";
  const validationSchema = useMemo(() => createBlogEditorSchema(t), [t]);

  const formik = useFormik<BlogEditorFormValues>({
    initialValues: EMPTY_FORM,
    validationSchema,
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: () => {
      /* handled by persistPost */
    },
  });

  const uploadId = useMemo(
    () => (numericId ? `post_${numericId}` : `new_${Date.now()}`),
    [numericId],
  );

  const persistPost = useCallback(
    async (status: BlogPostStatus) => {
      if (!role) return;
      const values = { ...formik.values, status };
      const errors = await formik.validateForm(values);
      if (Object.keys(errors).length > 0) {
        void formik.setTouched(
          Object.fromEntries(Object.keys(errors).map((k) => [k, true])),
        );
        return;
      }

      setUploadingImages(true);
      try {
        const { coverImageUrl, bodyHtml } = await uploadPendingBlogImages({
          coverPendingFile,
          coverSavedUrl,
          bodyHtml: values.bodyHtml,
          bodyPendingByUrl: bodyPendingByUrlRef.current,
          uploadId,
          isAdmin,
        });

        if (coverPendingFile) {
          revokeBlobUrl(coverPreviewUrl);
          setCoverPendingFile(null);
          setCoverPreviewUrl(coverImageUrl);
          setCoverSavedUrl(coverImageUrl);
        }

        for (const blobUrl of bodyPendingByUrlRef.current.keys()) {
          if (!bodyHtml.includes(blobUrl)) {
            revokeBlobUrl(blobUrl);
          }
        }
        bodyPendingByUrlRef.current.clear();

        const body = buildPayload(
          { ...values, coverImageUrl, bodyHtml },
          status,
          isAdmin,
        );

        if (isNew) {
          const result = await dispatch(createStaffBlogPost({ role, body }));
          if (createStaffBlogPost.fulfilled.match(result)) {
            toast({
              title: t("staffPortal.blog.toast.created"),
              description: t("staffPortal.blog.toast.createdDesc"),
            });
            navigate(`/staff/blog/${result.payload.id}/edit`, { replace: true });
          }
          return;
        }

        if (numericId) {
          const result = await dispatch(
            updateStaffBlogPost({ role, postId: numericId, body }),
          );
          if (updateStaffBlogPost.fulfilled.match(result)) {
            formik.resetForm({ values: postToForm(result.payload) });
            setCoverSavedUrl(result.payload.coverImageUrl);
            setCoverPreviewUrl(result.payload.coverImageUrl);
            setSlugEdited(true);
            loadedPostIdRef.current = result.payload.id;
            toast({
              title: t("staffPortal.blog.toast.saved"),
              description: t("staffPortal.blog.toast.savedDesc"),
            });
          }
        }
      } finally {
        setUploadingImages(false);
        setPreviewOpen(false);
      }
    },
    [
      coverPendingFile,
      coverPreviewUrl,
      coverSavedUrl,
      dispatch,
      formik,
      isAdmin,
      isNew,
      navigate,
      numericId,
      role,
      t,
      toast,
      uploadId,
    ],
  );

  const saveWithStatus = (status: BlogPostStatus) => {
    void persistPost(status);
  };

  const openPreview = (mode: "preview" | "publish") => {
    setPreviewMode(mode);
    setPreviewOpen(true);
  };

  const debouncedSlug = useDebouncedValue(formik.values.slug, 400);
  const publicPath = `/blog/${formik.values.slug || "…"}`;

  useEffect(() => {
    if (isNew && !loadedPostIdRef.current) {
      void formik.setFieldValue("locale", normalizeBlogLocale(i18n.language));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- default locale for new posts only
  }, [isNew, i18n.language]);

  useEffect(() => {
    if (!isNew && numericId && role) {
      dispatch(fetchStaffBlogPost({ role, postId: numericId }));
    }
    return () => {
      dispatch(clearStaffBlogPost());
    };
  }, [dispatch, isNew, numericId, role]);

  useEffect(() => {
    if (staffPost && !isNew && staffPost.id !== loadedPostIdRef.current) {
      loadedPostIdRef.current = staffPost.id;
      formik.resetForm({ values: postToForm(staffPost) });
      setSlugEdited(true);
      setCoverSavedUrl(staffPost.coverImageUrl);
      setCoverPreviewUrl(staffPost.coverImageUrl);
      setCoverPendingFile(null);
      bodyPendingByUrlRef.current.clear();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per post id
  }, [staffPost, isNew]);

  useEffect(() => {
    return () => {
      for (const url of bodyPendingByUrlRef.current.keys()) {
        revokeBlobUrl(url);
      }
    };
  }, []);

  useEffect(() => {
    if (isAdmin) {
      dispatch(fetchAdminEvents({ status: "published" }));
      dispatch(fetchAdminOrganizers({}));
    } else if (role) {
      dispatch(fetchOrganizerEvents());
    }
  }, [dispatch, isAdmin, role]);

  useEffect(() => {
    if (!role || !debouncedSlug.trim()) {
      setSlugCheck({ available: true, checking: false });
      return;
    }
    const normalized = normalizeBlogSlug(debouncedSlug);
    if (!normalized) {
      setSlugCheck({ available: false, checking: false });
      return;
    }

    let cancelled = false;
    setSlugCheck((s) => ({ ...s, checking: true }));

    void dispatch(
      checkBlogSlug({
        role,
        slug: normalized,
        excludeId: numericId ?? undefined,
      }),
    ).then((result) => {
      if (cancelled) return;
      if (checkBlogSlug.fulfilled.match(result)) {
        setSlugCheck({
          available: result.payload.available,
          suggestion: result.payload.suggestion,
          checking: false,
        });
      } else {
        setSlugCheck({ available: true, checking: false });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedSlug, dispatch, numericId, role]);

  useEffect(() => {
    if (!formik.dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [formik.dirty]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void persistPost(formik.values.status);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [formik.values.status, persistPost]);

  const handleTitleChange = (title: string) => {
    void formik.setFieldValue("title", title);
    if (!slugEdited) {
      void formik.setFieldValue("slug", slugify(title));
    }
  };

  const handleSlugChange = (raw: string) => {
    setSlugEdited(true);
    void formik.setFieldValue("slug", slugify(raw));
  };

  const regenerateSlug = () => {
    setSlugEdited(false);
    void formik.setFieldValue("slug", slugify(formik.values.title));
  };

  const applySlugSuggestion = () => {
    if (slugCheck.suggestion) {
      setSlugEdited(true);
      void formik.setFieldValue("slug", slugCheck.suggestion);
    }
  };

  const handleSelectCover = (file: File) => {
    const validationError = validateBlogImageFile(file, t);
    if (validationError) return;
    if (coverPreviewUrl?.startsWith("blob:")) {
      revokeBlobUrl(coverPreviewUrl);
    }
    setCoverPendingFile(file);
    setCoverPreviewUrl(createBlobPreviewUrl(file));
  };

  const handleClearCover = () => {
    if (coverPreviewUrl?.startsWith("blob:")) {
      revokeBlobUrl(coverPreviewUrl);
    }
    setCoverPendingFile(null);
    setCoverPreviewUrl(null);
    setCoverSavedUrl(null);
    void formik.setFieldValue("coverImageUrl", null);
  };

  const stageEditorImage = useCallback(
    (file: File): string | null => {
      const validationError = validateBlogImageFile(file, t);
      if (validationError) {
        toast({
          title: t("staffPortal.blog.editor.imageUploadFailed"),
          description: validationError,
          variant: "destructive",
        });
        return null;
      }
      const previewUrl = createBlobPreviewUrl(file);
      bodyPendingByUrlRef.current.set(previewUrl, file);
      return previewUrl;
    },
    [t, toast],
  );

  const eventOptions = useMemo(() => {
    if (!isAdmin || !formik.values.organizerId) return staffEvents;
    return staffEvents.filter((ev) => ev.organizer_id === formik.values.organizerId);
  }, [formik.values.organizerId, isAdmin, staffEvents]);

  const selectedOrganizerName = useMemo(() => {
    if (!formik.values.organizerId) return null;
    return (
      adminOrganizers.find((o) => o.id === formik.values.organizerId)?.name ??
      staffPost?.organizerName ??
      eventOptions.find((e) => e.id === formik.values.eventId)?.organizer_name ??
      null
    );
  }, [
    adminOrganizers,
    eventOptions,
    formik.values.eventId,
    formik.values.organizerId,
    staffPost?.organizerName,
  ]);
  const pageTitle = isNew ? t("staffPortal.blog.newPost") : t("staffPortal.blog.editPost");

  if (invalidId) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4">
        <PortalErrorAlert error={t("staffPortal.blog.invalidPostId")} />
        <Button variant="outline" asChild className="mt-4">
          <Link to="/staff/blog">{t("staffPortal.blog.backToList")}</Link>
        </Button>
      </div>
    );
  }

  if (!isNew && staffPostLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <span>{t("staffPortal.blog.loading")}</span>
      </div>
    );
  }

  const slugError = formik.touched.slug && formik.errors.slug;
  const titleError = formik.touched.title && formik.errors.title;
  const slugTaken = !slugCheck.checking && !slugCheck.available && formik.values.slug;
  const isBusy = saving || uploadingImages;

  const previewArticle = {
    title: formik.values.title,
    excerpt: formik.values.excerpt,
    coverImageUrl: coverPreviewUrl,
    bodyHtml: formik.values.bodyHtml,
    authorName: staffPost?.authorName ?? null,
    readTimeMinutes: staffPost?.readTimeMinutes ?? 5,
    publishedAt: staffPost?.publishedAt ?? null,
    organizerName:
      selectedOrganizerName ??
      staffPost?.organizerName ??
      eventOptions.find((e) => e.id === formik.values.eventId)?.organizer_name ??
      null,
  };

  return (
    <div className="max-w-4xl mx-auto w-full min-w-0 space-y-6 pb-10">
      <MetaHelmet title={pageTitle} description={t("staffPortal.blog.subtitle")} noindex />

      <BlogPublishPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        mode={previewMode}
        article={previewArticle}
        confirming={isBusy}
        onConfirm={
          previewMode === "publish"
            ? () => void persistPost("published")
            : undefined
        }
      />

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2 text-muted-foreground">
            <Link to="/staff/blog">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              {t("staffPortal.blog.backToList")}
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-foreground">{pageTitle}</h1>
          {formik.dirty ? (
            <p className="text-xs text-muted-foreground mt-1">
              {t("staffPortal.blog.unsavedChanges")}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!isNew && staffPost?.status === "published" ? (
            <Button variant="outline" size="sm" asChild>
              <a href={publicPath} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-1.5" />
                {t("staffPortal.blog.actions.viewLive")}
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!formik.values.title.trim()}
            onClick={() => openPreview("preview")}
          >
            <Eye className="w-4 h-4 mr-1.5" />
            {t("staffPortal.blog.actions.preview")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isBusy || !formik.values.title.trim()}
            onClick={() => saveWithStatus("draft")}
          >
            {isBusy && formik.values.status === "draft" ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-1.5" />
            )}
            {uploadingImages
              ? t("staffPortal.blog.actions.uploading")
              : t("staffPortal.blog.actions.saveDraft")}
          </Button>
          <Button
            type="button"
            className="btn-primary"
            size="sm"
            disabled={
              isBusy ||
              !formik.values.title.trim() ||
              Boolean(slugTaken) ||
              slugCheck.checking
            }
            onClick={() => openPreview("publish")}
          >
            <Check className="w-4 h-4 mr-1.5" />
            {t("staffPortal.blog.actions.publish")}
          </Button>
        </div>
      </div>

      {staffPostError ? <PortalErrorAlert error={staffPostError} /> : null}
      {saveError ? <PortalErrorAlert error={saveError} /> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void persistPost(formik.values.status);
        }}
        className="card-sport p-5 md:p-6 space-y-6"
        noValidate
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="blog-title">{t("staffPortal.blog.fields.title")} *</Label>
            <Input
              id="blog-title"
              name="title"
              value={formik.values.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              onBlur={formik.handleBlur}
              placeholder={t("staffPortal.blog.fields.titlePlaceholder")}
              className={cn(titleError && "border-destructive")}
            />
            {titleError ? (
              <p className="text-xs text-destructive">{titleError}</p>
            ) : null}
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="blog-slug">{t("staffPortal.blog.fields.slug")} *</Label>
            <div className="flex gap-2">
              <Input
                id="blog-slug"
                name="slug"
                value={formik.values.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                onBlur={formik.handleBlur}
                placeholder={t("staffPortal.blog.fields.slugPlaceholder")}
                className={cn(
                  "font-mono text-sm",
                  (slugError || slugTaken) && "border-destructive",
                )}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                title={t("staffPortal.blog.regenerateSlug")}
                onClick={regenerateSlug}
              >
                <Sparkles className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="text-muted-foreground font-mono">{publicPath}</span>
              {slugCheck.checking ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {t("staffPortal.blog.slugChecking")}
                </span>
              ) : slugTaken ? (
                <span className="text-destructive">
                  {t("staffPortal.blog.slugTaken")}
                  {slugCheck.suggestion ? (
                    <button
                      type="button"
                      className="ml-2 underline text-primary hover:text-primary/80"
                      onClick={applySlugSuggestion}
                    >
                      {t("staffPortal.blog.useSuggestion", {
                        slug: slugCheck.suggestion,
                      })}
                    </button>
                  ) : null}
                </span>
              ) : formik.values.slug ? (
                <span className="inline-flex items-center gap-1 text-accent">
                  <Check className="w-3 h-3" />
                  {t("staffPortal.blog.slugAvailable")}
                </span>
              ) : null}
            </div>
            {slugError ? <p className="text-xs text-destructive">{slugError}</p> : null}
            {!slugEdited && formik.values.title ? (
              <p className="text-xs text-muted-foreground">
                {t("staffPortal.blog.slugAutoHint")}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="blog-status">{t("staffPortal.blog.fields.status")}</Label>
            <Select
              value={formik.values.status}
              onValueChange={(v) => void formik.setFieldValue("status", v)}
            >
              <SelectTrigger id="blog-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t("staffPortal.blog.status.draft")}</SelectItem>
                <SelectItem value="published">
                  {t("staffPortal.blog.status.published")}
                </SelectItem>
                <SelectItem value="archived">{t("staffPortal.blog.status.archived")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blog-locale">{t("staffPortal.blog.fields.locale")}</Label>
            <Select
              value={formik.values.locale}
              onValueChange={(v) => void formik.setFieldValue("locale", v)}
            >
              <SelectTrigger id="blog-locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="es">{t("blog.locale.es")}</SelectItem>
                <SelectItem value="en">{t("blog.locale.en")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("staffPortal.blog.fields.localeHint")}
            </p>
          </div>

          {isAdmin ? (
            <div className="space-y-2">
              <Label htmlFor="blog-organizer">{t("staffPortal.blog.fields.organizer")}</Label>
              <Select
                value={
                  formik.values.organizerId ? String(formik.values.organizerId) : "platform"
                }
                onValueChange={(v) => {
                  const nextOrgId = v === "platform" ? null : Number(v);
                  void formik.setFieldValue("organizerId", nextOrgId);
                  if (formik.values.eventId) {
                    const ev = staffEvents.find((e) => e.id === formik.values.eventId);
                    if (ev && nextOrgId != null && ev.organizer_id !== nextOrgId) {
                      void formik.setFieldValue("eventId", null);
                    }
                  }
                }}
              >
                <SelectTrigger id="blog-organizer">
                  <SelectValue placeholder={t("staffPortal.blog.fields.organizerPlatform")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="platform">
                    {t("staffPortal.blog.fields.organizerPlatform")}
                  </SelectItem>
                  {adminOrganizers.map((org) => (
                    <SelectItem key={org.id} value={String(org.id)}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {t("staffPortal.blog.fields.organizerHint")}
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="blog-event">{t("staffPortal.blog.fields.relatedEvent")}</Label>
            <Select
              value={formik.values.eventId ? String(formik.values.eventId) : "none"}
              onValueChange={(v) => {
                const nextEventId = v === "none" ? null : Number(v);
                void formik.setFieldValue("eventId", nextEventId);
                if (isAdmin && nextEventId) {
                  const ev = staffEvents.find((e) => e.id === nextEventId);
                  if (ev?.organizer_id) {
                    void formik.setFieldValue("organizerId", ev.organizer_id);
                  }
                }
              }}
            >
              <SelectTrigger id="blog-event">
                <SelectValue placeholder={t("staffPortal.blog.fields.relatedEventNone")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  {t("staffPortal.blog.fields.relatedEventNone")}
                </SelectItem>
                {eventOptions.map((ev) => (
                  <SelectItem key={ev.id} value={String(ev.id)}>
                    {ev.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="blog-excerpt">{t("staffPortal.blog.fields.excerpt")}</Label>
            <Textarea
              id="blog-excerpt"
              name="excerpt"
              value={formik.values.excerpt}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              rows={3}
              placeholder={t("staffPortal.blog.fields.excerptPlaceholder")}
            />
            <p className="text-xs text-muted-foreground text-right">
              {formik.values.excerpt.length}/2000
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("staffPortal.blog.fields.cover")}</Label>
          <BlogImageUpload
            previewUrl={coverPreviewUrl}
            onSelectFile={handleSelectCover}
            onClear={handleClearCover}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("staffPortal.blog.fields.body")}</Label>
          <RichHtmlEditor
            value={formik.values.bodyHtml}
            onChange={(html) => void formik.setFieldValue("bodyHtml", html)}
            onStageImage={stageEditorImage}
          />
        </div>

        <div className="border-t border-border pt-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-primary">
            {t("staffPortal.blog.seoSection")}
          </h2>

          <div className="space-y-2">
            <Label htmlFor="blog-seo-title">{t("staffPortal.blog.fields.seoTitle")}</Label>
            <Input
              id="blog-seo-title"
              name="seoTitle"
              value={formik.values.seoTitle}
              onChange={formik.handleChange}
              placeholder={formik.values.title}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="blog-seo-desc">{t("staffPortal.blog.fields.seoDescription")}</Label>
            <Textarea
              id="blog-seo-desc"
              name="seoDescription"
              value={formik.values.seoDescription}
              onChange={formik.handleChange}
              rows={2}
              placeholder={formik.values.excerpt}
            />
            <p className="text-xs text-muted-foreground text-right">
              {formik.values.seoDescription.length}/500
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="blog-og-image">{t("staffPortal.blog.fields.ogImageUrl")}</Label>
            <Input
              id="blog-og-image"
              value={formik.values.ogImageUrl || ""}
              onChange={(e) =>
                void formik.setFieldValue("ogImageUrl", e.target.value.trim() || null)
              }
              placeholder={formik.values.coverImageUrl || "https://"}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border pt-6">
          <div>
            <Label htmlFor="blog-featured">{t("staffPortal.blog.fields.featured")}</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("staffPortal.blog.fields.featuredHint")}
            </p>
          </div>
          <Switch
            id="blog-featured"
            checked={formik.values.featured}
            onCheckedChange={(checked) => void formik.setFieldValue("featured", checked)}
          />
        </div>
      </form>
    </div>
  );
}
