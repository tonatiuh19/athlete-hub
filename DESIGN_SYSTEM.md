# Triboo Sport — Design System

Brand reference: **Manual de Marca — Triboo Sport**

## Color palette

| Token | Hex | Usage |
|-------|-----|--------|
| Triboo Black | `#05070D` | Page background, deep surfaces |
| White | `#FFFFFF` | Primary text on dark |
| Triboo Orange | `#FF5A1F` | Primary brand, CTAs, highlights |
| Triboo Red | `#F23C35` | Secondary accent, gradient end |
| Triboo Gradient | `#FF5A1F → #F23C35` | Buttons, stats banners, hero emphasis |

## Light / dark theme

- **Toggle:** `ThemeToggle` in home navbar (desktop), site footer, and staff mobile header. Preference stored in `localStorage` key `triboo-theme` via `next-themes`.
- **Default:** `system` — follows the browser/OS `prefers-color-scheme`. User override via toggle (footer, staff portal) stored in `localStorage` (`triboo-theme`: `light` | `dark` | `system`).
- **Tokens:** `:root` = light palette; `.dark` = Triboo dark palette. Use semantic utilities (`bg-background`, `text-foreground`, `bg-card`, `text-muted-foreground`, `border-border`, `primary`, `accent`) — never hardcode `text-white` / `gray-*` on standard page surfaces.
- **Staff sidebar:** follows theme via `sidebar-*` tokens (`bg-sidebar`, `text-sidebar-foreground`, etc.).
- **Hero / video overlays:** may keep light text on cinematic media; page content below hero must follow tokens.
- **Logos:** `TribooLogo` with `surface="auto"` swaps orange wordmark (light) vs white wordmark (dark).

## Semantic tokens (Tailwind / CSS variables)

Use design-system tokens in UI — **not** arbitrary Tailwind colors:

- `primary` — Triboo orange
- `accent` — Triboo red-orange
- `background` / `bg-triboo-black` — deep black
- `foreground`, `muted`, `card`, `border`, `destructive`

Legacy `cyan` utilities remain in tailwind for gradual migration; prefer `primary` on new work.

## Typography

- **Display / UI:** [Archivo](https://fonts.google.com/specimen/Archivo) (brand manual: Archivo Expanded)
- Weights: 400–900 for hierarchy

## Logos

Assets live in **`public/brand/logos/`** (repo root — Vite `publicDir`, not `client/public/`). Use `TribooLogo` component (local path + CDN fallback on error):

- Nav / hero on dark: `horizontal-white` (orange mark + white wordmark)
- Light surfaces: `horizontal-orange` or `symbol-orange`

Source URLs documented in `client/constants/tribooBrand.ts`.

## Hero / marketing

- Cinematic full-viewport hero (video + vignette + film grain)
- Horizontal “poster” event carousel (streaming-style)
- Triboo gradient on emphasized headline word

## SEO (`MetaHelmet`)

- Use `MetaHelmet` on every route; private areas (`/login`, `/portal`, `/staff`) auto-`noindex`.
- **Images:** pass `image` or `images[]` (with optional `width`, `height`, `type`, `alt`). Emits full Open Graph + Twitter image tags; defaults to `DEFAULT_OG_IMAGE` (1200×630).
- **Public pages:** set `path`, `alternateLocales`, and `description`. Event pages use `ogType="article"` + `publishedTime` / `articleSection`.
- Override share asset: `VITE_DEFAULT_OG_IMAGE` and `VITE_PUBLIC_APP_URL` in `.env`.

## Mobile / responsive

- **No page-level horizontal scroll:** `html`, `body`, and `#root` use `overflow-x: clip` and `overscroll-behavior-x: none`.
- **Portal & staff pages:** wrap content in `w-full min-w-0 overflow-x-clip`; use `PageContent` (`client/components/layouts/PageContent.tsx`) for new pages.
- **Flex layouts:** always set `min-w-0` on flex children that should shrink; use `max-w-full` on roots instead of `100vw` (avoids scrollbar width overflow).
- **Tables:** `DataGrid` scrolls inside `overflow-x-auto` (default `noBleeding`); prefer `mobileCard` for small screens.
- **Intentional horizontal scroll:** only inside components (tab bars, hero carousels, filter chips) with `overflow-x-auto scrollbar-hide` and `overscroll-x-contain`.
- **Events browse (`/events`) mobile:** theme-aware hero backdrop (light gradients in light mode, triboo-black glow in dark — same as home); search-only header; **`SportTypesChipCarousel`** filter chips; bottom **`HeroMobileFiltersSheet`**; icon-only view toggles until `sm`; default **grid** view below `lg`.
- **Marketplace search inputs:** inner shell is always `bg-card` — input text and placeholders use `text-foreground` / `placeholder:text-muted-foreground` only (never hardcoded white), so light and dark themes stay readable.
- **Home mobile:** hide featured **Events** `SectionHeader`; show **`HomeSportTypesSection`** with navigate-mode sport chips linking to `/events?sport=…`.
- **Home map:** **`HomeEventsMapSection`** — after featured events grid; lazy-loaded Leaflet map with `EventsMap` + `MapEventPreview`; mobile horizontal compact cards + map; desktop list + map split; links to `/events`.
- **Home FAQ:** **`HomeFaqSection`** — before final CTA; 6 curated athlete questions via **`FaqAccordion`** + sticky help card linking to `/help`. Copy in i18n (`faq.items.*`); structure in `client/constants/faqStructure.ts`.
- **Staff events list (`/staff/events`):** **`DataGrid`** with server-side pagination (`page`/`limit`/`total`, max 100), sortable columns, search + status filters, and `mobileCard` actions. Calendar view loads up to 100 matching events. Filter dropdowns elsewhere request `limit=100`.
- **Registration confirmation invite:** After successful checkout (solo + group), show **`RegistrationInviteFriendsCard`** with event link — Share (Web Share API), Copy link, WhatsApp. Gradient card + avatar stack; reuse on both result steps.
- **Staff event Campos extra (`EventEdit` fields tab):** **`StaffRegistrationFieldsGuide`** legend of built-in identity fields + buy-for-others behavior; soft overlap warnings via `matchBuiltinRegistrationField` when labels duplicate Nombre/Email/DOB/etc.
- **Group registration Campos extra:** Per participant sub-step **Questions** (`WizardRegistrationFieldsForm`) after identity; category-scoped; validated server-side on group checkout; review shows answered count.
- **Event bib mode:** Details tab **`StaffEventBibModePicker`** — folio = dorsal vs separate. Mirrored read-only on Custom folios with strong note. New events default `folio`; existing migrate to `separate`.
- **Registration workspace:** Staff registration sheet is an ops hub (check-in / bib / cancel / QR / party) for `REGISTRATION_OPS_ROLES` (includes timing). Purchaser **QR wallet** holds passes for managed minors and unclaimed guests after group checkout, in athlete portal, and via group-order email deep link (`?wallet=1`).
- **Dynamic registration export:** Event registrations **Export CSV** opens a column picker (presets + per-field / per-extra toggles). Server builds the full filtered set via `GET …/export-catalog` + `POST …/registrations/export` — not the current grid page.
- **Registrations event filter:** Global registrations uses **`StaffEventSearchPicker`** (searchable combobox). Inline bib edit/save is removed from grids — assign bib only in **`StaffRegistrationDetailSheet`** (or bulk CSV import).
- **Dialogs:** base `DialogContent` caps width at `min(calc(100vw - 2rem), …)` with vertical scroll only.

## Staff — Payouts & Connect (MX)

- **Route:** `/staff/payouts` — organizer owner/finance/organizer roles.
- **Dual checklist pattern:** Triboo profile (Step 1) then bank verification (Step 2). Use `destructive` border/text for incomplete blocking states; `accent` for ready/CTA. Do not surface third-party payment provider names in UI copy.
- **`StaffFeeCalculatorCard`:** Reusable fee breakdown for **pass-through** (inscription + service fee) and **absorb-all** (public sticker with illustrative IVA slice). Props: `feePresentation`, `serviceFeePercent`. Used on Payouts, admin Connect panel, and create-organizer dialog.
- **Fee modes:** Organizer default on `/staff/payouts`; optional per-event override on Event Edit (`inherit` | `pass_through` | `absorb_all`). Category price labels change with mode (inscription vs sticker).
- **Marketplace `from_price_cents`:** Athlete-facing minimum (pass-through includes service fee).
- **`StaffAdminConnectPanel`:** Admin assisted onboarding in organizer detail sheet — never implies KYC can be skipped.
- **EventEdit publish gate:** Destructive banner when paid categories exist and `payoutReady` is false (organizer → `/staff/payouts`; admin → `/staff/people?tab=organizers`).
- **Event approval workflow:** Organizer **Submit for approval** sets `status: pending_approval` (not public). Admin **Publish** only from `pending_approval` → `published`. Admin **Reject** returns to `draft` and stores `approval_rejection_reason`. Use `StaffStatusBadge` / `pending_approval` token in lists and event edit banners.
- **Live event alert:** `StaffPaidEventPayoutAlert` on dashboard, events list, and event hub when `payments_available === false` on a published paid event.
- **Organizer payout nudge:** `StaffOrganizerPayoutSetupBanner` in `StaffLayout` when `payoutReady` is false (hidden on `/staff/payouts`). Proactive `primary` tone — not destructive. Rendered inside the shared `max-w-6xl` staff content shell so it aligns with dashboard headings and cards. **Desktop:** inline card with icon tile, text left, CTA right (`lg:flex-row`). **Mobile:** fixed sticky bar at bottom with matching `max-w-6xl` inner width.
- **Athlete event page:** `GET /api/events/:slug` returns `payments_available` + `has_paid_categories`. Paid categories show `primary` info banner and disabled purchase UI when `payments_available === false`; free categories remain registerable.
- **Semantic tokens only** — no arbitrary Tailwind colors on payout/checklist UI.

## Staff — Event image crop & previews

- **`EventAssetUpload`** (image kind + `imageRole`) opens **`EventImageCropDialog`** after file pick: zoom, aspect presets, live multi-context previews, then outputs a cropped file staged for CDN upload on save.
- **Roles:** `hero` (cards, home, search, compact list), `banner` (detail hero + social), `sponsor` (inverted logo chips), `gallery` (media grid). Media tab maps `asset_type` via `resolveEventImageRole`.
- **Preview mocks:** `EventImageContextPreview` mirrors destination layouts (marketplace card, detail hero, sponsor strip, gallery tile) with semantic tokens — not arbitrary colors.
- **Output:** JPEG for photos; PNG preserved for sponsor logos with alpha. Max width 1600px (hero/gallery), 1200px (sponsor).
