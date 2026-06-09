import { format } from "date-fns";
import type { EventListItem } from "@shared/api";
import type { HeroEvent } from "@/components/home/HeroEventCard";
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
      event.hero_image_url ||
      "https://images.unsplash.com/photo-1452626212852-811edd589ec7?w=900&q=80&auto=format&fit=crop",
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
    slug: event.slug,
    imageUrl:
      event.hero_image_url ||
      "https://images.unsplash.com/photo-1452626212852-811edd589ec7?w=900&q=80&auto=format&fit=crop",
  };
}
