import {
  type LegalEntityConfig,
  isLegalFieldEmpty,
  legalFieldDisplay,
} from "@shared/siteLegal";

const CONDITIONAL_BLOCK = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

function entityField(entity: LegalEntityConfig, key: string): unknown {
  return (entity as Record<string, unknown>)[key];
}

/** Strip optional {{#field}}…{{/field}} blocks when field is empty; replace {{field}} placeholders. */
export function applyLegalTemplate(
  markdown: string,
  entity: LegalEntityConfig,
): string {
  let out = markdown.replace(CONDITIONAL_BLOCK, (_match, key: string, inner: string) => {
    const value = entityField(entity, key);
    if (isLegalFieldEmpty(value)) return "";
    return inner;
  });

  for (const key of Object.keys(entity) as (keyof LegalEntityConfig)[]) {
    const token = `{{${key}}}`;
    const display = legalFieldDisplay(entity[key]) ?? "";
    out = out.split(token).join(display);
  }

  return cleanupLegalMarkdown(out);
}

function cleanupLegalMarkdown(text: string): string {
  return text
    .split("\n")
    .map((line) =>
      line
        .replace(/,\s*,/g, ",")
        .replace(/,\s*\./g, ".")
        .replace(/\(\s*,/g, "(")
        .replace(/,\s*\)/g, ")")
        .replace(/\s{2,}/g, " ")
        .trimEnd(),
    )
    .join("\n");
}
