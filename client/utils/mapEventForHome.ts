import { format } from "date-fns";
import type { EventListItem } from "@shared/api";
import type { HeroEvent } from "@/components/home/HeroEventCard";
import { DEFAULT_EVENT_HERO_IMAGE } from "@/constants/eventImages";
import { optimizeEventMediaUrl } from "@/lib/cdn-url";
import { getDateFnsLocale } from "@/utils/dateLocale";

const ACCENTS: HeroEvent["accent"][] = ["orange", "red", "ember"];

export function mapEventToHeroEvent(
  event: EventListItem,
  index: number,
  language: string,
): HeroEvent {
  const dateLocale = getDateFnsLocale(language);
  const locationParts = [event.location_city, event.location_state].filter(Boolean);
  return {
    title: event.title,
    location: locationParts.join(", ") || event.location_country,
    date: format(new Date(event.start_date), "d MMM yyyy", { locale: dateLocale }),
    distance: event.sport_name,
    participants: event.registration_count,
    slug: event.slug,
    imageUrl:
      optimizeEventMediaUrl(event.hero_image_url, "featured") ||
      optimizeEventMediaUrl(DEFAULT_EVENT_HERO_IMAGE, "featured")!,
    accent: ACCENTS[index % ACCENTS.length],
  };
}

export function mapEventToFeaturedCard(
  event: EventListItem,
  language: string,
): {
  title: string;
  location: string;
  date: string;
  distance: string;
  participants: number;
  category: string;
  sportSlug: string;
  imageUrl: string;
  slug: string;
} {
  const dateLocale = getDateFnsLocale(language);
  const locationParts = [event.location_city, event.location_country].filter(Boolean);
  return {
    title: event.title,
    location: locationParts.join(", "),
    date: format(new Date(event.start_date), "d MMM yyyy", { locale: dateLocale }),
    distance: event.sport_name,
    participants: event.registration_count,
    category: event.sport_name,
    sportSlug: event.sport_slug,
    slug: event.slug,
    imageUrl:
      optimizeEventMediaUrl(event.hero_image_url, "featured") ||
      optimizeEventMediaUrl(DEFAULT_EVENT_HERO_IMAGE, "featured")!,
  };
}
