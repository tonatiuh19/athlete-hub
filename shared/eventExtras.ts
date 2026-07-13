export type EventExtraType =
  | "merch"
  | "addon"
  | "folio"
  | "service"
  | "experience"
  | "custom";

export const EVENT_EXTRA_TYPES: EventExtraType[] = [
  "merch",
  "addon",
  "folio",
  "service",
  "experience",
  "custom",
];

export function isValidEventExtraType(value: unknown): value is EventExtraType {
  return typeof value === "string" && EVENT_EXTRA_TYPES.includes(value as EventExtraType);
}

export interface SelectedExtraInput {
  extraId: number;
  quantity: number;
}

export interface ResolvedExtraLine {
  extraId: number;
  name: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export function sumExtrasSubtotalCents(lines: ResolvedExtraLine[]): number {
  return lines.reduce((sum, line) => sum + line.totalCents, 0);
}
