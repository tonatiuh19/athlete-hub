import * as Yup from "yup";
import type { CategoryFormValues } from "@/components/staff/StaffEventCategoryFormFields";
import type { PayoutProfileForm } from "@/utils/payoutProfileValidation";

export type StaffFormMissingSeverity = "required" | "recommended";

export interface StaffFormMissingItem {
  id: string;
  /** i18n key for chip label */
  labelKey: string;
  severity: StaffFormMissingSeverity;
  /** DOM id suffix — combined with idPrefix in forms */
  focusTarget?: string;
}

export function getFormikMissingItems(
  values: unknown,
  schema: Yup.AnyObjectSchema,
  fieldLabels: Record<string, string>,
  options?: {
    severity?: StaffFormMissingSeverity;
    focusTargets?: Record<string, string>;
  },
): StaffFormMissingItem[] {
  const severity = options?.severity ?? "required";
  const focusTargets = options?.focusTargets;
  try {
    schema.validateSync(values, { abortEarly: false });
    return [];
  } catch (err) {
    if (!(err instanceof Yup.ValidationError)) return [];
    const paths = new Set<string>();
    const items: StaffFormMissingItem[] = [];
    for (const inner of err.inner.length > 0 ? err.inner : [err]) {
      const path = inner.path;
      if (!path || paths.has(path)) continue;
      paths.add(path);
      const labelKey = fieldLabels[path];
      if (!labelKey) continue;
      items.push({
        id: path,
        labelKey,
        severity,
        focusTarget: focusTargets?.[path] ?? path,
      });
    }
    return items;
  }
}

export function getCategoryFormMissing(
  values: CategoryFormValues,
  priceMxn: string | number | undefined,
  options?: { idPrefix?: string; showPrice?: boolean },
): StaffFormMissingItem[] {
  const idPrefix = options?.idPrefix ?? "cat";
  const showPrice = options?.showPrice ?? true;
  const items: StaffFormMissingItem[] = [];

  if (!values.name?.trim()) {
    items.push({
      id: "name",
      labelKey: "staffPortal.eventEdit.categoryName",
      severity: "required",
      focusTarget: `${idPrefix}-name`,
    });
  }

  if (showPrice) {
    const priceStr =
      priceMxn === undefined || priceMxn === null ? "" : String(priceMxn).trim();
    const priceNum = Number(priceStr);
    if (priceStr === "" || !Number.isFinite(priceNum) || priceNum < 0) {
      items.push({
        id: "price",
        labelKey: "staffPortal.eventEdit.categoryPriceInscription",
        severity: "required",
        focusTarget: `${idPrefix}-price`,
      });
    }
  }

  return items;
}

export function getPayoutProfileMissing(values: PayoutProfileForm): StaffFormMissingItem[] {
  const items: StaffFormMissingItem[] = [];
  if (!values.legal_name.trim()) {
    items.push({
      id: "legal_name",
      labelKey: "staffPortal.payouts.fieldLegalName",
      severity: "required",
      focusTarget: "legal_name",
    });
  }
  if (!values.billing_email.trim()) {
    items.push({
      id: "billing_email",
      labelKey: "staffPortal.payouts.fieldBillingEmail",
      severity: "required",
      focusTarget: "billing_email",
    });
  }
  if (!values.rfc.trim()) {
    items.push({
      id: "rfc",
      labelKey: "staffPortal.payouts.fieldRfc",
      severity: "required",
      focusTarget: "rfc",
    });
  }
  return items;
}

export function getExtraFormMissing(name: string): StaffFormMissingItem[] {
  if (name.trim()) return [];
  return [
    {
      id: "name",
      labelKey: "staffPortal.eventEdit.extraName",
      severity: "required",
      focusTarget: "extra-new-name",
    },
  ];
}

export function getWaiverDraftMissing(
  drafts: Array<{ title?: string; content_type?: string; html_content?: string | null }>,
): StaffFormMissingItem[] {
  if (drafts.length === 0) {
    return [
      {
        id: "waiver",
        labelKey: "staffPortal.eventEdit.waiverName",
        severity: "required",
      },
    ];
  }
  const items: StaffFormMissingItem[] = [];
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i];
    if (!d.title?.trim()) {
      items.push({
        id: `waiver-title-${i}`,
        labelKey: "staffPortal.eventEdit.waiverName",
        severity: "required",
      });
    }
    const ct = d.content_type ?? "html";
    if ((ct === "html" || ct === "both") && !d.html_content?.trim()) {
      items.push({
        id: `waiver-html-${i}`,
        labelKey: "staffPortal.eventEdit.waiverContent",
        severity: "required",
      });
    }
  }
  return items;
}

export function focusStaffFormField(focusTarget?: string) {
  if (!focusTarget) return;
  const el = document.getElementById(focusTarget);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  if (el instanceof HTMLElement && "focus" in el) {
    el.focus({ preventScroll: true });
  }
}
