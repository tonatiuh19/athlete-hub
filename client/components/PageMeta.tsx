/**
 * @deprecated Prefer `MetaHelmet` directly for full SEO control.
 * Thin wrapper kept for backward compatibility.
 */
import MetaHelmet, { type MetaHelmetProps } from "./MetaHelmet";

export type PageMetaProps = Pick<
  MetaHelmetProps,
  "title" | "description" | "image" | "path" | "noindex" | "keywords" | "jsonLd"
>;

export default function PageMeta({ title, description, ...rest }: PageMetaProps) {
  return <MetaHelmet title={title} description={description} {...rest} />;
}
