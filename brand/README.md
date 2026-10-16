# Neoma brand

One design system for the website, the docs, published sites and the app.
If a colour, font, radius or logo is not in this folder, it should not be in
the product. The public version of this guide, with the full design process,
is at [neomadev.app/brand](https://www.neomadev.app/brand).

## The mark: Tidal block

![Neoma mark](logo/mark-light.svg)

A page, parted by a current. One solid square, one tilde-shaped cut.

- **`~` is home.** In every terminal, `~` is your home folder. Your vault
  lives on your machine.
- **`~` is approximately.** Research is provisional; notes hold ideas that are
  nearly right, until they are.
- **Two halves, one line.** Two notes, divided and connected by the same link.

### Construction (100-unit grid)

| Part      | Value                                                                       |
| --------- | --------------------------------------------------------------------------- |
| Page      | 64 × 64 square at (18, 18), corner radius 9                                 |
| Channel   | `M4 60 C18 30, 38 32, 50 50 C62 68, 82 70, 96 40`                           |
| Cut width | 8 (regular), 11 (small: favicons and anything under 32 px)                  |
| Symmetry  | The curve is point-symmetric about (50, 50), so both halves have equal area |

All geometry lives in [`scripts/brand-assets.mjs`](../scripts/brand-assets.mjs).
Run `npm run icons` after changing it; every file below is regenerated.

### Files

| File                                                            | Use                                                             |
| --------------------------------------------------------------- | --------------------------------------------------------------- |
| `logo/mark.svg`                                                 | The mark in `currentColor`. Inline use, monochrome.             |
| `logo/mark-light.svg` · `mark-dark.svg` · `mark-fern.svg`       | Fixed-colour marks                                              |
| `logo/mark-small.svg`                                           | Optical size for 16 to 32 px                                    |
| `logo/icon.svg`                                                 | App icon, flat: Fern tile, Paper mark                           |
| `logo/icon-ink.svg`                                             | Alternative tile: Ink with a Sage mark                          |
| `logo/favicon.svg`                                              | Favicon: tighter tile, small optical size                       |
| `logo/icon-macos.svg`                                           | macOS master: Apple grid, top light, contact shadow             |
| `logo/icon-square.svg`                                          | Full bleed for iOS, Android and GitHub (the platform rounds it) |
| `logo/icon-maskable.svg`                                        | PWA maskable (mark inside the 80% safe zone)                    |
| `logo/wordmark*.svg`                                            | The wordmark, outlined                                          |
| `logo/lockup-light.svg` · `lockup-dark.svg` · `lockup-fern.svg` | Mark and wordmark                                               |
| `export/*.png`                                                  | 1024 px icons and a 500 px avatar for press and social          |

Rules: keep clear space of a quarter of the mark on every side; below 24 px
use the favicon; never rotate, outline, add effects or recolour outside the
palette. The macOS icon may carry light; the flat mark underneath is the
truth.

### Wordmark

**neoma**, lowercase, outlined from IBM Plex Sans at weight 580 with
−12 units of tracking. In the lockup its x-height is 55% of the page and its
baseline sits on the page's lower third.

## Colour

| Token             | Light           | Dark           | Role                                     |
| ----------------- | --------------- | -------------- | ---------------------------------------- |
| `--nm-bg`         | `#f7f8f4` Paper | `#141815`      | Page background                          |
| `--nm-bg-sunken`  | `#eef1ec`       | `#0f1311`      | Wells, code                              |
| `--nm-surface`    | `#ffffff`       | `#1b211d`      | Panels, editor                           |
| `--nm-text`       | `#171c19` Ink   | `#ebefea`      | Body text                                |
| `--nm-text-muted` | `#535b56`       | `#a3aca5`      | Secondary text                           |
| `--nm-border`     | `#dfe4de`       | `#29302b`      | Hairlines                                |
| `--nm-accent`     | `#276749` Fern  | `#7cc49a` Sage | Links, focus, the one thing that matters |
| `--nm-success`    | `#3b7a2f`       | `#9ccb78`      | Status only                              |

Stone `#e8ece7` is the quiet fill for icons and illustrations. Neutrals carry
a trace of green so the palette reads as one material. Contrast: Ink on Paper
16.2:1, graphite 6.6:1, Fern 6.3:1, Sage on Ink 8.4:1. `--nm-text-faint` is for
metadata at 12 px and above.

Considered and set aside: **Mineral** (`#2c6a63`), cooler and more technical;
**Deep botanical** (`#183d2b`), rich but too dark to read as a link. The old
neon green (`#4ade80`) is retired.

## Type

- **Neoma Sans** (IBM Plex Sans, variable): interface and prose.
- **Neoma Mono** (IBM Plex Mono): code, paths, metadata, keys.

Self-hosted from `fonts/` under the SIL Open Font License
([OFL.txt](fonts/OFL.txt)). Never load fonts from a third-party CDN: the
privacy promise covers the website too.

## Shape, depth, motion

Radius 2, 4, 6, 8 px. Borders carry structure; shadows only for things that
float. Motion is short (120 to 200 ms) and always respects reduced motion.

## Motifs

Use the product's own grammar: `[[wiki links]]`, `[@citations]`, paths like
`~/Research/`, the tilde, small neutral graphs with one Fern highlight. No
blob art, no stock illustration, no mascot.

## Copy

Short and declarative. "Plain Markdown. Nothing proprietary." No em dashes in
user-facing copy. Never lead with AI. Never describe something that is not
shipped as if it were.
