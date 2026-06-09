/**
 * @deprecated Prefer `MetaHelmet` directly for full SEO control.
 */
import MetaHelmet, { type MetaHelmetProps } from "./MetaHelmet";

export type PageMetaProps = MetaHelmetProps;

export default function PageMeta(props: PageMetaProps) {
  return <MetaHelmet {...props} />;
}
