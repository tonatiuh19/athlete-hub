import type { StaffEventCategoryInput } from "@shared/api";

export type EventCategoryTemplateId =
  | "5k"
  | "10k"
  | "21k"
  | "42k"
  | "master_10k"
  | "female_10k";

export interface EventCategoryTemplate {
  id: EventCategoryTemplateId;
  /** i18n key under staffPortal.eventEdit.categoryTemplates */
  nameKey: string;
  descriptionKey?: string;
  defaults: Pick<
    StaffEventCategoryInput,
    "distance_km" | "min_age" | "max_age" | "gender_restriction" | "difficulty"
  >;
}

export const EVENT_CATEGORY_TEMPLATES: EventCategoryTemplate[] = [
  {
    id: "5k",
    nameKey: "5k",
    defaults: { distance_km: 5, gender_restriction: "any", difficulty: "beginner" },
  },
  {
    id: "10k",
    nameKey: "10k",
    defaults: { distance_km: 10, gender_restriction: "any", difficulty: "intermediate" },
  },
  {
    id: "21k",
    nameKey: "21k",
    defaults: { distance_km: 21, gender_restriction: "any", difficulty: "intermediate" },
  },
  {
    id: "42k",
    nameKey: "42k",
    defaults: { distance_km: 42, gender_restriction: "any", difficulty: "advanced" },
  },
  {
    id: "master_10k",
    nameKey: "master10k",
    descriptionKey: "master10kDesc",
    defaults: {
      distance_km: 10,
      min_age: 40,
      gender_restriction: "any",
      difficulty: "intermediate",
    },
  },
  {
    id: "female_10k",
    nameKey: "female10k",
    descriptionKey: "female10kDesc",
    defaults: {
      distance_km: 10,
      gender_restriction: "female",
      difficulty: "intermediate",
    },
  },
];

export function templateToCategoryInput(
  template: EventCategoryTemplate,
  name: string,
  priceCents: number,
): StaffEventCategoryInput {
  return {
    name,
    price_cents: priceCents,
    ...template.defaults,
  };
}
