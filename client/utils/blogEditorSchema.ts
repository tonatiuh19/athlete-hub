import * as Yup from "yup";
import { BLOG_SLUG_PATTERN } from "@shared/slugify";

export function createBlogEditorSchema(t: (key: string) => string) {
  return Yup.object({
    title: Yup.string()
      .trim()
      .required(t("staffPortal.blog.validation.titleRequired"))
      .max(300, t("staffPortal.blog.validation.titleMax")),
    slug: Yup.string()
      .trim()
      .required(t("staffPortal.blog.validation.slugRequired"))
      .max(180, t("staffPortal.blog.validation.slugMax"))
      .matches(BLOG_SLUG_PATTERN, t("staffPortal.blog.validation.slugFormat")),
    excerpt: Yup.string().max(2000, t("staffPortal.blog.validation.excerptMax")),
    bodyHtml: Yup.string(),
    coverImageUrl: Yup.string().nullable(),
    seoTitle: Yup.string().max(300, t("staffPortal.blog.validation.seoTitleMax")),
    seoDescription: Yup.string().max(500, t("staffPortal.blog.validation.seoDescMax")),
    ogImageUrl: Yup.string().nullable(),
    status: Yup.mixed<"draft" | "published" | "archived">().oneOf([
      "draft",
      "published",
      "archived",
    ]),
    featured: Yup.boolean(),
    locale: Yup.mixed<"es" | "en">().oneOf(["es", "en"]),
    eventId: Yup.number().nullable(),
    organizerId: Yup.number().nullable(),
  });
}

export type BlogEditorFormValues = Yup.InferType<
  ReturnType<typeof createBlogEditorSchema>
>;
