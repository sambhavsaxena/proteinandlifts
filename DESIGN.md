---
name: Trainory
description: The Trainory design language, shared by the website and the mobile app (trainory-app). Lime on a near-black canvas, with a light scheme derived from it. Inter throughout, hairline borders, 12px cards, pill-shaped primary buttons. Lime is a fill; a darker lime "accent" carries text, charts and progress on light backgrounds.

colors:
  light:
    ink: "#111315"
    body: "#43473f"
    mute: "#5a5f57"
    hairline: "#dde0d7"
    muted: "#eceee7"
    canvas: "#f5f6f2"
    elevated: "#ffffff"
    inverse: "#ffffff"
    primary: "#c6ff00"
    on-primary: "#111315"
    accent: "#4f6a00"
    good: "#2f7a45"
    warn: "#9a6f12"
    warn-soft: "#fff4dc"
    bad: "#d33a3c"
  dark:
    ink: "#f5f5f5"
    body: "#c9ccc5"
    mute: "#a9ada6"
    hairline: "#2f3337"
    muted: "#24282c"
    canvas: "#111315"
    elevated: "#1b1e21"
    inverse: "#111315"
    primary: "#c6ff00"
    on-primary: "#111315"
    accent: "#c6ff00"
    good: "#8ec899"
    warn: "#e8be62"
    warn-soft: "#2a1f08"
    bad: "#ea6a64"

typography:
  family: Inter, Arial, sans-serif
  display: { size: 36px, weight: 600, tracking: -0.025em }
  title: { size: 24px, weight: 600, tracking: -0.025em }
  heading: { size: 20px, weight: 600 }
  body: { size: 16px, weight: 400, lineHeight: 24px }
  small: { size: 14px, weight: 400, lineHeight: 20px }
  eyebrow: { size: 12px, weight: 500, uppercase: true, tracking: wide }

rounded:
  sm: 6px
  md: 8px
  lg: 12px
  pill: 9999px
---

# Trainory design

The website and the mobile app share one look. The tokens above are the
source of truth for the web (`src/styles/global.css`); the app's copy lives in
`src/constants/theme.ts` in trainory-app. Change both together.

## Colour

- **Lime (`primary`)** is a fill: primary buttons, the selected chip, the
  hero. Text on it is always `on-primary`. Lime is too light to read as text on
  the light canvas, so never use it for text there.
- **`accent`** is lime as ink: links, focus rings, chart series, progress rings
  and bars, selected outlines. It is dark olive in the light scheme and lime in
  the dark one.
- **`ink`** carries headings and important numbers, `body` paragraphs, `mute`
  meta text and axis labels. `hairline` is every border and chart grid line;
  `muted` is a quiet fill (tracks, pressed rows).
- `good`, `warn` and `bad` are for status only (target hit, warnings,
  destructive actions).

## Type

Inter for everything, with tabular figures (`.num`) wherever numbers line up.
Headings are semibold with slightly tight tracking. Eyebrows are small,
medium-weight capitals in `mute`.

## Shape

Cards are 12px radius with a hairline border on `elevated`. App buttons are
small rounded rectangles; marketing CTAs are pills. The logo tile (black arm on
lime, ~22% corner radius) is the same in both themes, and the wordmark is
lowercase "trainory" in `accent`.
