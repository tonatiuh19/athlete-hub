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
- **Dialogs:** base `DialogContent` caps width at `min(calc(100vw - 2rem), …)` with vertical scroll only.
