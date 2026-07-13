import type { EventExtraType } from "@shared/eventExtras";
import type { StaffEventExtraInput } from "@shared/api";

export type EventExtraTemplateId =
  | "official_tee"
  | "running_shorts"
  | "gold_folio"
  | "finisher_medal"
  | "vip_bag_drop"
  | "parking_pass"
  | "post_race_meal"
  | "photo_package"
  | "recovery_kit"
  | "hydration_belt"
  | "massage_session"
  | "spectator_pass"
  | "commemorative_hoodie"
  | "chip_timing_premium";

export interface EventExtraTemplate {
  id: EventExtraTemplateId;
  extra_type: EventExtraType;
  /** i18n key under staffPortal.eventEdit.extraTemplates */
  nameKey: string;
  descriptionKey: string;
  /** Suggested default price in MXN pesos (not cents) */
  suggestedPriceMxn: number;
  max_per_athlete?: number;
}

export const EVENT_EXTRA_TEMPLATES: EventExtraTemplate[] = [
  {
    id: "official_tee",
    extra_type: "merch",
    nameKey: "officialTee",
    descriptionKey: "officialTeeDesc",
    suggestedPriceMxn: 450,
    max_per_athlete: 3,
  },
  {
    id: "running_shorts",
    extra_type: "merch",
    nameKey: "runningShorts",
    descriptionKey: "runningShortsDesc",
    suggestedPriceMxn: 550,
    max_per_athlete: 2,
  },
  {
    id: "commemorative_hoodie",
    extra_type: "merch",
    nameKey: "commemorativeHoodie",
    descriptionKey: "commemorativeHoodieDesc",
    suggestedPriceMxn: 750,
    max_per_athlete: 2,
  },
  {
    id: "gold_folio",
    extra_type: "folio",
    nameKey: "goldFolio",
    descriptionKey: "goldFolioDesc",
    suggestedPriceMxn: 150,
    max_per_athlete: 1,
  },
  {
    id: "finisher_medal",
    extra_type: "addon",
    nameKey: "finisherMedal",
    descriptionKey: "finisherMedalDesc",
    suggestedPriceMxn: 200,
    max_per_athlete: 2,
  },
  {
    id: "chip_timing_premium",
    extra_type: "addon",
    nameKey: "chipTimingPremium",
    descriptionKey: "chipTimingPremiumDesc",
    suggestedPriceMxn: 120,
    max_per_athlete: 1,
  },
  {
    id: "vip_bag_drop",
    extra_type: "service",
    nameKey: "vipBagDrop",
    descriptionKey: "vipBagDropDesc",
    suggestedPriceMxn: 180,
    max_per_athlete: 1,
  },
  {
    id: "parking_pass",
    extra_type: "service",
    nameKey: "parkingPass",
    descriptionKey: "parkingPassDesc",
    suggestedPriceMxn: 250,
    max_per_athlete: 1,
  },
  {
    id: "post_race_meal",
    extra_type: "experience",
    nameKey: "postRaceMeal",
    descriptionKey: "postRaceMealDesc",
    suggestedPriceMxn: 180,
    max_per_athlete: 2,
  },
  {
    id: "photo_package",
    extra_type: "experience",
    nameKey: "photoPackage",
    descriptionKey: "photoPackageDesc",
    suggestedPriceMxn: 350,
    max_per_athlete: 1,
  },
  {
    id: "recovery_kit",
    extra_type: "addon",
    nameKey: "recoveryKit",
    descriptionKey: "recoveryKitDesc",
    suggestedPriceMxn: 280,
    max_per_athlete: 1,
  },
  {
    id: "hydration_belt",
    extra_type: "merch",
    nameKey: "hydrationBelt",
    descriptionKey: "hydrationBeltDesc",
    suggestedPriceMxn: 320,
    max_per_athlete: 1,
  },
  {
    id: "massage_session",
    extra_type: "service",
    nameKey: "massageSession",
    descriptionKey: "massageSessionDesc",
    suggestedPriceMxn: 400,
    max_per_athlete: 1,
  },
  {
    id: "spectator_pass",
    extra_type: "experience",
    nameKey: "spectatorPass",
    descriptionKey: "spectatorPassDesc",
    suggestedPriceMxn: 100,
    max_per_athlete: 4,
  },
];

export function templateToExtraInput(
  template: EventExtraTemplate,
  name: string,
  priceCents: number,
): StaffEventExtraInput {
  return {
    name,
    description: null,
    price_cents: priceCents,
    extra_type: template.extra_type,
    max_per_athlete: template.max_per_athlete ?? 1,
  };
}
