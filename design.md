# Shire Mobile — Design System

Design language extracted from [shireintelligence.com](https://shireintelligence.com). Apply these tokens and patterns to the Flutter admin mobile app for visual continuity with the marketing site.

---

## 1. Brand Character

**Personality:** Warm, intelligent, premium. "Restaurant operations brain" — sophisticated tech with a hospitality feel.

**Mood:** Calm confidence. Cream + sky palette signals approachability; soft shadows and generous spacing signal premium. Nothing harsh, nothing flashy.

**Visual rules:**
- Warm neutrals dominate; cool blues are accents and signals
- Soft, blurred shadows — never sharp drop shadows
- Generous whitespace; never crowded
- Pill-shaped CTAs, rounded cards (20–28px)
- Type does the heavy lifting — minimal ornament

---

## 2. Color Palette

### Warm neutrals (base — backgrounds, surfaces)
| Token | Hex | Use |
|---|---|---|
| `cream/50` | `#FAFAFA` | App background (lightest) |
| `cream/100` | `#F9F8F8` | Default surface |
| `cream/200` | `#F4F1EE` | Elevated card / section background |
| `cream/300` | `#F1EBE5` | Hover / pressed surface |
| `sand/200` | `#EDDFD0` | Subtle warm accent panel |
| `sand/300` | `#F4E6DA` | Highlighted warm panel |
| `stone/100` | `#EDEFF0` | Neutral grey panel |
| `stone/200` | `#E4E2E2` | Dividers, borders |

### Sky blues (primary accent, data, links)
| Token | Hex | Use |
|---|---|---|
| `sky/50` | `#F0F6FF` | Lightest blue tint panel |
| `sky/100` | `#E9EFFF` | Soft blue panel bottom |
| `sky/200` | `#E2ECF5` | Info card background |
| `sky/300` | `#A7CBF2` | Decorative gradient stop |
| `sky/400` | `#9CC1E7` | Secondary accent |
| `sky/500` | `#84B9EF` | **Primary accent (brand blue)** |
| `sky/600` | `#6F86FF` | Electric accent / focus rings |
| `sky/700` | `#156CC2` | Primary action / link |

### Dark text & UI
| Token | Hex | Use |
|---|---|---|
| `ink/900` | `#1A1615` | Primary text (warm near-black) |
| `ink/800` | `#151313` | Headlines |
| `ink/700` | `#453F3D` | Secondary text |
| `ink/600` | `#614A44` | Tertiary / warm brown text |
| `ink/500` | `#757170` | Muted text, captions |
| `ink/400` | `#616161` | Disabled / placeholder |

### Signal colors (status, semantic)
| Token | Hex | Use |
|---|---|---|
| `success/600` | `#0EA158` | Success, positive metric |
| `success/700` | `#118647` | Success emphasis |
| `success/800` | `#168804` | Success deep |
| `warning/600` | `#CF8D13` | Warning, gold accent |
| `danger/600` | `#C9502E` | Error, rust/destructive |
| `warmth/600` | `#754D29` | Warm earth accent |

### Pure
- `white` `#FFFFFF`
- `black` `#000000`

### Signature gradients
```css
/* Hero / splash background — cream rising to sky */
linear-gradient(180deg, #FAFAFA 0%, #F9F8F8 36%, #F4F1EE 48%, #E2ECF6 73%, #A7CBF2 125%)

/* Soft blue panel (cards, dashboards) */
linear-gradient(180deg, #F0F6FF 0%, #E9EFFF 100%)

/* Glass overlay on imagery */
linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0) 100%)
```

---

## 3. Typography

**Font families**
- **Primary:** `Inter` — all UI, body, headlines. Use variable weights.
- **Mono accent:** `Fragment Mono` — labels, metric eyebrows, data callouts, timestamps. Use sparingly for character.

**Type scale** (mobile-tuned)

| Role | Size | Weight | Line-height | Tracking |
|---|---|---|---|---|
| Display / Hero | 44–56 | 600 | 1.05 | -0.02em |
| H1 (screen title) | 32 | 600 | 1.1 | -0.015em |
| H2 (section) | 24 | 600 | 1.2 | -0.01em |
| H3 (card title) | 20 | 600 | 1.25 | -0.005em |
| Title / List | 18 | 500 | 1.3 | 0 |
| Body | 16 | 400 | 1.5 | 0 |
| Body small | 14 | 400 | 1.45 | 0 |
| Caption | 13 | 500 | 1.4 | 0.01em |
| Eyebrow / Tag | 12 | 500 (Mono) | 1.3 | 0.06em UPPERCASE |

**Rules**
- Headlines: tight tracking, no all-caps
- Eyebrows + numeric metrics: `Fragment Mono`, slightly tracked
- Never bold body — emphasis is via 500, not 700
- Color defaults: `ink/900` on light, `ink/500` for secondary

---

## 4. Spacing & Layout

**Base unit:** 4px. Stick to multiples.

| Token | Value |
|---|---|
| `space/1` | 4 |
| `space/2` | 8 |
| `space/3` | 12 |
| `space/4` | 16 |
| `space/5` | 20 |
| `space/6` | 24 |
| `space/8` | 32 |
| `space/10` | 40 |
| `space/12` | 48 |
| `space/16` | 64 |

**Layout**
- Screen edge padding: `20` (compact) or `24` (default)
- Card interior padding: `20–24`
- Section vertical rhythm: `32–48` between sections
- List row min-height: `56`
- Tap target min: `44 × 44`

---

## 5. Shape — Radii

The marketing site uses generous rounded corners. Carry this through.

| Token | Value | Use |
|---|---|---|
| `radius/sm` | 12 | Inputs, chips, small buttons |
| `radius/md` | 20 | Default cards |
| `radius/lg` | 24 | Hero cards, sheets |
| `radius/xl` | 28 | Large featured surfaces |
| `radius/2xl` | 40 | Modal sheets, marquee panels |
| `radius/full` | 9999 (`100px`) | Pill buttons, avatar, tags |

Bottom sheets: top-radius `28`. Modal dialogs: `24`.

---

## 6. Elevation — Shadows

Soft, diffuse, **tinted to the surface they sit on**. No hard greys.

```dart
// Warm shadow (default — on cream surfaces)
BoxShadow(color: Color(0x1A614A44), blurRadius: 50, offset: Offset(0, 4))

// Cool shadow (on blue / data surfaces)
BoxShadow(color: Color(0x1A3C78BE), blurRadius: 45, offset: Offset(0, 18))

// Inner highlight (premium top-edge sheen for elevated cards)
// Implemented as a 1px top border at rgba(255,255,255,0.7)
```

| Token | Value |
|---|---|
| `shadow/sm` | `0 2px 8px rgba(97,74,68,0.06)` |
| `shadow/md` | `0 4px 50px rgba(97,74,68,0.10)` (warm default) |
| `shadow/lg` | `0 18px 45px rgba(60,120,190,0.10)` (cool, for data cards) |
| `shadow/inset-top` | `inset 0 1px 0 rgba(255,255,255,0.7)` |

Avoid stacking >1 outer shadow. Combine outer + inset highlight for the "lifted glass" feel.

---

## 7. Components

### Buttons

**Primary (filled)**
- Background: `ink/900` `#1A1615` (or `sky/700` `#156CC2` for data-related primary actions)
- Text: `white`, 16/500
- Radius: `radius/full` (pill)
- Padding: 14 × 24
- Shadow: `shadow/md`
- Pressed: scale 0.98, no shadow change

**Secondary (outline)**
- Background: `white`
- Border: 1px `stone/200` `#E4E2E2`
- Text: `ink/900`
- Same radius/padding as primary
- Optional `shadow/inset-top` for premium feel

**Tertiary (text)**
- Text: `sky/700` `#156CC2`, 16/500
- No background; underline on press

**Destructive**
- Background: `danger/600` `#C9502E`
- Text: `white`

### Cards

```
Background:   #FFFFFF or cream/200 (#F4F1EE)
Border:       1px stone/200 (#E4E2E2)  — optional, on white only
Radius:       radius/md (20) or radius/lg (24)
Padding:      20
Shadow:       shadow/md
```

**Data card variant:** background `sky/50` → `sky/100` gradient, no border, `shadow/lg`.

### Inputs

- Height: 52
- Background: `cream/100` `#F9F8F8`
- Border: 1px `stone/200`; focus → 1.5px `sky/600` `#6F86FF`
- Radius: `radius/sm` (12)
- Label above (eyebrow style, mono, `ink/500`)
- Inner padding: 16

### Lists / Rows

- Row: 16 vertical padding, divider `stone/200` `#E4E2E2`, leading icon `24px`
- Selected row: `cream/200` background, no divider above/below
- Chevron: `ink/500`, 20px

### Tags / Chips

- Pill (`radius/full`)
- Padding: 6 × 12
- Background tinted by semantic: `sky/200`, `sand/300`, success/warning tints at ~15% opacity
- Text: 12/500, mono, slightly tracked

### Navigation

**Top bar**
- Background: matches screen (cream or white), no shadow when at top, `shadow/sm` on scroll
- Title: 18/600, `ink/900`, centered or leading
- Actions: icon 24px in `ink/700`

**Bottom tab bar**
- Background: `white` with 1px top border `stone/200`
- Active: icon + label `ink/900`, label 12/500
- Inactive: `ink/500`
- Height: 64 + safe area

### Bottom sheets / Modals

- Top radius: 28
- Background: `white`
- Drag handle: 4 × 36, `stone/200`, top margin 8
- Shadow: `shadow/lg`
- Overlay: `rgba(0,0,0,0.2)`

### Metric / KPI tiles

Signature pattern from the site:
- Large mono number (`Fragment Mono`, 40–56px, `ink/900`)
- Eyebrow label above (mono, 12px, `ink/500`, uppercase, tracked)
- Optional delta chip below (success or danger tint)
- Background: `sky/50` → `sky/100` gradient, `radius/lg`, `shadow/lg`

---

## 8. Iconography

- Style: **outline**, 1.5–2px stroke, rounded joints
- Default size: 24
- Color: `ink/700` default, `ink/900` active, `sky/700` for action icons
- Recommended set: Phosphor (Regular) or Lucide

---

## 9. Imagery

- Photography: warm, natural light; restaurant/hospitality scenes
- Treatment: soft, slightly desaturated; never high-contrast
- Use a `rgba(255,255,255,0.7) → transparent` top gradient overlay when placing text on photos
- Illustration: minimal line work, sky/600 accent strokes on cream backgrounds

---

## 10. Motion

- Duration: 200ms (micro), 320ms (default), 480ms (sheet/page)
- Curve: `Curves.easeOutCubic` (default), `Curves.easeInOutCubic` (sheets)
- Press: scale to 0.98 over 120ms
- Avoid bounces and overshoots — the brand is calm

---

## 11. Dark Mode (forward-looking)

Site is light-only. If/when implementing dark:
- Background base: `#151313` (`ink/800`)
- Elevated surface: `#1A1615` with `shadow/inset-top` highlight
- Primary text: `#F9F8F8`
- Accent blue: shift to `#84B9EF` for AA contrast
- Keep semantic signal colors at +10% lightness

---

## 12. Flutter Token Snippet

Drop into `lib/theme/colors.dart` (or equivalent):

```dart
class AppColors {
  // Warm neutrals
  static const cream50  = Color(0xFFFAFAFA);
  static const cream100 = Color(0xFFF9F8F8);
  static const cream200 = Color(0xFFF4F1EE);
  static const cream300 = Color(0xFFF1EBE5);
  static const sand200  = Color(0xFFEDDFD0);
  static const sand300  = Color(0xFFF4E6DA);
  static const stone100 = Color(0xFFEDEFF0);
  static const stone200 = Color(0xFFE4E2E2);

  // Sky
  static const sky50  = Color(0xFFF0F6FF);
  static const sky100 = Color(0xFFE9EFFF);
  static const sky200 = Color(0xFFE2ECF5);
  static const sky300 = Color(0xFFA7CBF2);
  static const sky400 = Color(0xFF9CC1E7);
  static const sky500 = Color(0xFF84B9EF); // primary accent
  static const sky600 = Color(0xFF6F86FF); // focus
  static const sky700 = Color(0xFF156CC2); // primary action

  // Ink
  static const ink900 = Color(0xFF1A1615);
  static const ink800 = Color(0xFF151313);
  static const ink700 = Color(0xFF453F3D);
  static const ink600 = Color(0xFF614A44);
  static const ink500 = Color(0xFF757170);
  static const ink400 = Color(0xFF616161);

  // Signal
  static const success = Color(0xFF0EA158);
  static const warning = Color(0xFFCF8D13);
  static const danger  = Color(0xFFC9502E);
  static const warmth  = Color(0xFF754D29);
}

class AppRadius {
  static const sm = 12.0;
  static const md = 20.0;
  static const lg = 24.0;
  static const xl = 28.0;
  static const xxl = 40.0;
  static const full = 9999.0;
}

class AppShadows {
  static const warmMd = [
    BoxShadow(color: Color(0x1A614A44), blurRadius: 50, offset: Offset(0, 4)),
  ];
  static const coolLg = [
    BoxShadow(color: Color(0x1A3C78BE), blurRadius: 45, offset: Offset(0, 18)),
  ];
}
```

---

## 13. Quick application checklist

When building a screen:

1. **Background:** `cream/50` or `cream/100` — never pure white as the canvas
2. **Cards:** rounded `20–24`, warm shadow, generous interior padding (`20`+)
3. **Primary CTA:** pill, dark ink — only one per screen
4. **Numbers/metrics:** Fragment Mono, large, in a sky-tinted gradient tile
5. **Type:** Inter, weight 400/500/600 only — never 700+
6. **Dividers:** `stone/200`, never pure grey
7. **Empty space is the design** — if it feels crowded, remove something

# Shire Label App — Design System

Design language extracted from the Gallery / Annotation web app (`label/components/*.vue`). Apply these tokens and patterns to any new screen in the Nuxt label app to keep visual continuity with the existing surfaces.

---

## 1. Brand Character

**Personality:** Calm, premium, work-focused. The annotator's tool — quiet enough to disappear for hours, characterful enough to feel crafted.

**Mood:** Warm cream + cool sky. Soft tinted shadows over hard greys. The data is the star; chrome recedes.

**Visual rules:**
- Cream surfaces, ink-900 text — never pure white on pure black
- Soft, tinted, diffuse shadows; no sharp drops
- Pill controls everywhere (`rounded-full`); rectangular only for action surfaces (`rounded-lg`) and data cards
- Eyebrow labels in mono uppercase; body in Inter
- One characterful gesture per screen (glow nav buttons, swipe card) — everything else is restrained
- Floating popovers via `position: fixed`, never trapped inside overflow contexts

---

## 2. Color Palette

### Warm neutrals (base)
| Token | Hex | Use |
|---|---|---|
| `cream/50` | `#FAFAFA` | Page background (`<section class="bg-cream-50">`) |
| `cream/100` | `#F9F8F8` | Default surface, skeleton fill, loading veil |
| `cream/200` | `#F4F1EE` | Shimmer base color |
| `sand/300` | `#F4E6DA` | Warm gradient start (completion CTA) |
| `stone/200` | `#E4E2E2` | Borders, dividers — the only neutral grey |

### Sky (primary accent, focus, links)
| Token | Hex | Use |
|---|---|---|
| `sky/50` | `#F0F6FF` | Soft data panel top |
| `sky/100` | `#E9EFFF` | Soft data panel bottom |
| `sky/600` | `#6F86FF` | Focus ring color (focus-visible) |
| `sky/700` | `#156CC2` | Active pill border, pagination current, ring-offset, retry link, primary data accent |

### Ink (text + dark UI)
| Token | Hex | Use |
|---|---|---|
| `ink/900` | `#1A1615` | Primary text, "Next" / "Clear all" CTA bg, DISCARDED chip |
| `ink/700` | `#453F3D` | Secondary text, default pill text |
| `ink/500` | `#757170` | Mono eyebrows, captions, count separators |

### Signal (annotation states)
| Token | Hex | State |
|---|---|---|
| `success/600` | `#0EA158` | CLEAN chip |
| `success/700` | `#118647` | CLEAN button, completion gradient mid |
| `danger/600` | `#C9502E` | DIRTY chip + button, error text |
| `warning/600` | `#CF8D13` | OCCUPIED chip + button, warm gradient mid |
| `ink/900` | `#1A1615` | DISCARDED chip + button, neutral terminal state |

### Glow gradient stops (nav CTAs)
```css
/* Royal sky (Continue annotating) */
background:
  radial-gradient(ellipse 110% 80% at 50% 0%, rgba(255,255,255,0.22) 0%, transparent 60%),
  linear-gradient(180deg, #3B82F6 0%, #2563EB 100%);

/* Royal purple (Confirm audited) */
background:
  radial-gradient(ellipse 110% 80% at 50% 0%, rgba(255,255,255,0.22) 0%, transparent 60%),
  linear-gradient(180deg, #8B5CF6 0%, #7C3AED 100%);
```

Each pairs with `inset 0 1px 0 rgba(255,255,255,0.45)` (top sheen) and `inset 0 -1px 1px rgba(0,0,0,0.14)` (bottom edge) for tactile depth without an outer drop shadow.

---

## 3. Typography

**Fonts**
- **Inter** — UI, body, headlines (variable, weights 400 / 500 / 600)
- **Fragment Mono** (`font-mono`) — eyebrows, counts, captions, status chips, numeric input

**Scale (in use)**

| Role | Class / size | Weight | Notes |
|---|---|---|---|
| CTA label | `text-[14px]` / `text-[15px]` | 500 | Glow nav buttons, with `tracking-tight` |
| Body | `text-sm` (14px) | 400–500 | Pills, card meta primary |
| Small body | `text-xs` (12px) | 400 | Card meta secondary, hint text |
| Eyebrow | `text-[10px]` mono | 500 | `uppercase tracking-eyebrow text-ink-500` — labels above values, status chips |
| Count badge | `text-[11px]` mono | 500 | `tabular-nums`, on sky-700 chip |
| Numeric input | `text-sm` mono | 500 | `tabular-nums`, pagination input |

**Rules**
- All eyebrow labels: `font-mono text-[10px] uppercase tracking-eyebrow text-ink-500`
- Counters & page numbers always use `tabular-nums` to prevent layout shift
- Never bold (700+) — 600 is the heaviest weight used; emphasis is via 500 + color
- Truncate strings with `truncate` — never wrap mid-card

---

## 4. Spacing & Layout

**Base unit:** 4px.

| Token | Value | Common use |
|---|---|---|
| `gap-1` / `gap-1.5` | 4 / 6 | Inside pills, badge clusters |
| `gap-2` | 8 | Pill row gap, button group |
| `gap-3` | 12 | Pill→content gap, pagination clusters |
| `gap-4` | 16 | Glow button row gap, grid cell gap |
| `mb-6` | 24 | Glow nav → FilterBar |
| `mb-8` | 32 | FilterBar → grid |
| `px-8` | 32 | Page-edge horizontal padding |
| `pt-8` / `pb-32` | 32 / 128 | Top of canvas / clear sticky pagination |

**Page shell**
```
<section class="relative min-h-screen overflow-hidden bg-cream-50">
  <div class="relative z-10 max-w-full mx-auto px-8 pt-8 pb-32">
    ...
  </div>
</section>
```

**Grid (gallery)**
```
grid gap-4
grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
```

---

## 5. Radii

| Token | Value | Use |
|---|---|---|
| `rounded-sm` | 4 | Glow nav buttons, thumbnail in annotation strip |
| `rounded` | 4 | Inline status badges on thumbnails |
| `rounded-lg` | 8 | Cards, dropdown panels, empty / error blocks |
| `rounded-full` | 9999 | Filter pills, status chips, count badges, pagination buttons, primary CTAs, indicator dots |

**Rule:** action surfaces are pills; informational surfaces (cards, panels) use `rounded-lg`.

---

## 6. Elevation — Shadows

Tinted to the surface tone. No pure-grey drops.

### Warm shadows (on cream / white)
```css
/* Default card */
box-shadow: 0 4px 50px rgba(97, 74, 68, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.7);

/* Bottom pagination "rising" hint */
box-shadow: 0 -8px 30px rgba(60, 120, 190, 0.08);

/* Floating button (Next, Clear all) */
box-shadow: 0 4px 50px rgba(97, 74, 68, 0.10);
```

### Cool shadows (on dropdowns / data surfaces)
```css
/* Dropdown panel */
box-shadow: 0 18px 45px rgba(60, 120, 190, 0.12), 0 4px 50px rgba(97, 74, 68, 0.10);

/* Annotation card (image hero) */
box-shadow: 0 18px 45px rgba(60, 120, 190, 0.10), 0 4px 50px rgba(97, 74, 68, 0.10), inset 0 1px 0 rgba(255, 255, 255, 0.7);
```

### Inset highlights (premium edge)
```css
inset 0 1px 0 rgba(255, 255, 255, 0.7);   /* warm/white surfaces */
inset 0 1px 0 rgba(255, 255, 255, 0.45);  /* on saturated CTAs */
inset 0 -1px 1px rgba(0, 0, 0, 0.14);     /* CTA bottom edge */
```

**Rule:** combine **one** outer shadow + inset top highlight. Stacking two outer shadows is reserved for floating popovers and the pagination bar.

---

## 7. Components

### Filter pill (the workhorse)
```
h-9 pl-3 pr-3.5 rounded-full bg-white border text-sm font-medium
inactive: border-stone-200 hover:border-ink-700
active:   border-sky-700 ring-2 ring-sky-700/15
box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7)
```
- Label as mono eyebrow inside the pill (`text-[10px] uppercase tracking-eyebrow text-ink-500`)
- Value text `text-ink-700` or count badge `bg-sky-700 text-white rounded-full px-1.5 py-0.5`
- Caret SVG rotates 180° when open
- `active:scale-[0.98]` on press

### Boolean toggle pill
Same pill shell, but with a checkbox square inside:
- Off: `w-4 h-4 rounded-sm border-2 border-stone-200 bg-white`
- On: `bg-sky-700 border-sky-700` + white check SVG
- `aria-pressed` reflects state

### Date input pill
Pill shell, but `<label>` wrapping `<input type="date">` with `bg-transparent`. Native date picker. Storage format: `YYYY-MM-DD` (ISO-8601 — Python `datetime.fromisoformat` / FastAPI parse it directly). Empty → `null`.

### Dropdown panel
```
fixed z-50 w-56 / w-72 rounded-lg bg-white border border-stone-200 overflow-hidden
box-shadow: 0 18px 45px rgba(60,120,190,0.12), 0 4px 50px rgba(97,74,68,0.10)
```
- **`position: fixed`**, not `absolute` — escapes any ancestor `overflow` clipping
- Position computed from trigger's `getBoundingClientRect()`: `left: rect.left`, `top: rect.bottom + 8`
- Inner search input: `h-9 rounded-full bg-cream-100 border-transparent`; focus → `border-sky-700 bg-white`
- Option row: `px-3 py-2 flex items-center gap-3 hover:bg-cream-100` with `transition-colors duration-100`
- Footer "Clear N selected": `border-t border-stone-200 bg-cream-50`, mono eyebrow, hover → `text-danger-600`

### Glow nav button (primary CTAs)
```
flex-1 h-11 rounded-sm relative overflow-hidden cursor-pointer
focus-visible:outline-none hover:rotate-1
transition: transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1)
active: scale(0.98) over 120ms
```
- Two variants: **`.glow-sky`** (royal blue) and **`.glow-purple`** (royal purple)
- Linear gradient + radial top wash + inset top sheen + inset bottom edge
- White text, 14–15px, weight 500, slight tracking-tight
- Optional outline arrow / check SVG, `stroke-width: 1.75`
- Respect `prefers-reduced-motion` — disable transitions and rotate

### Gallery card (`GalleryCard.vue`)
```
group rounded-lg bg-white border border-stone-200 overflow-hidden
transition-transform duration-200 hover:-translate-y-[2px]
box-shadow: 0 4px 50px rgba(97,74,68,0.06), inset 0 1px 0 rgba(255,255,255,0.7)
```
- `aspect-[4/3] bg-black` image area
- Status chip top-right: `rounded-full px-2.5 py-1 backdrop-filter blur(8px)`, color-coded
- Hover state buttons: bottom strip, `opacity-0 group-hover:opacity-100 transition-opacity duration-150`, `backdrop-blur` for legibility
- Updating veil: `absolute inset-0 bg-cream-100/70 z-30` with sky-700-topped spinner

### Status chip (annotation state)
```
font-mono text-[10px] uppercase tracking-eyebrow rounded-full px-2.5 py-1
backdrop-filter: blur(8px)
```
| State | Background | Text |
|---|---|---|
| CLEAN | `bg-success-600/85` | white |
| DIRTY | `bg-danger-600/85` | white |
| OCCUPIED | `bg-warning-600/85` | white |
| UNLABELED | `bg-ink-900/80` | white |
| DISCARDED | `bg-ink-900/80` | white |
| (fallback) | `bg-white/85` + `border border-stone-200` | `text-ink-900` |

### Spinners & loading
- **Inline (icon)** — `w-3.5 h-3.5 rounded-full border-2 border-sky-700/30 border-t-sky-700 animate-spin`
- **Card-level** — `w-7 h-7 rounded-full border-2 border-stone-200 border-t-sky-700 animate-spin`
- **Skeleton shimmer** — `bg-cream-100` with a `linear-gradient(90deg, transparent, rgba(244,241,238,0.85), transparent)` running at 800px width, 1.4s linear infinite
- **Progress bar** — fixed 2px sky-700 sliver translating `-100%` → `400%` over 1.2s

### Pagination bar (sticky)
```
fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/85
backdrop-filter: blur(12px)
box-shadow: 0 -8px 30px rgba(60, 120, 190, 0.08)
```
- Prev/Next: `h-9 px-4 rounded-full`. "Next" is the **only** filled `bg-ink-900 text-white` CTA on the screen.
- First / Last: `h-9 w-9 rounded-full` icon pills
- Page input: `h-9 w-16 text-center rounded-full font-mono tabular-nums`
- Numbered pages: `h-7 min-w-[28px]` mini-pills; current page is `bg-ink-900 text-white`

### Annotation page (`AnnotationPage.vue`)
Specific to the annotation surface:
- Background: dotted grid + radial sky blobs weighted to the bottom — `radial-gradient(circle, #DCD9D5 1px, transparent 1.5px)` at 22×22px, layered over sky-colored ellipses
- Directional intent gradients on swipe — `danger-600` left, `success-700` right and up; opacity tracks the drag distance (`Math.min(1, dragX / 140)`)
- Card: white surface, `border border-stone-200`, rounded-lg, large cool+warm dual shadow + inset top sheen
- Side rails: rotated 90°/-90° pill triggers (Dirty, Clean) flank the card; top/bottom triggers (Occupied, Discarded) above/below
- Thumbnail strip: `overflow-x-auto`, scrollbar hidden via `.annotate-strip` scoped style. Current thumb: `ring-2 ring-sky-700 ring-offset-2 ring-offset-cream-50 scale-110`

---

## 8. Iconography

- **Style:** outline, `stroke-width: 1.5` (filter carets, checkmarks) or `1.75` (CTA arrows / completion check), rounded line joins
- **Sizes:** `w-3 h-3` for checkbox marks, `w-3.5 h-3.5` for inline carets/spinners, `w-4 h-4` for CTA icons, `w-5 h-5` / `w-7 h-7` for loading spinners
- **Color:** inherits `currentColor` from text — `text-ink-500` (caret idle), `text-ink-700` (default), `text-white` (on saturated CTAs)
- Decorative SVGs always `aria-hidden="true"`

---

## 9. Motion

| Token | Duration | Easing | Use |
|---|---|---|---|
| micro | `100–150ms` | `ease` / `cubic-bezier(0.2, 0.8, 0.2, 1)` | Color changes, pill hover, checkbox check |
| default | `200ms` | ease | Card hover, fade transitions |
| sheen | `320ms` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Glow CTA, dropdown transforms, swipe card spring |
| press | `120ms` | ease | `active:scale-[0.96–0.98]` snap-back |
| fling | `280ms` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Swipe-card exit on annotation page |
| sheet | `480ms` | (reserved) | Future bottom-sheet routes |

**Rules**
- Always `active:scale-[0.96]` (icon pills) or `[0.98]` (text pills/CTAs) — never instant
- Hover on cards uses `-translate-y-[2px]`, not scale (preserves grid alignment)
- Glow CTAs use `hover:rotate-1` for character — only place rotation is used
- `prefers-reduced-motion`: disable all `transition` and `transform` on glow elements; scroll-into-view becomes `behavior: 'auto'`

---

## 10. Scrollable rows (hidden scrollbar)

Used for `.filter-row` (filter pills) and `.annotate-strip` (annotation thumbnails). Same pattern, scoped per component:

```css
.scroll-row {
  overflow-x: auto;
  scrollbar-width: none;        /* Firefox */
  -ms-overflow-style: none;     /* Edge legacy */
}
.scroll-row::-webkit-scrollbar {
  display: none;                /* Chromium / Safari */
}
.scroll-row > * {
  flex-shrink: 0;               /* pills keep natural width, push into overflow */
}
```

**Gotcha:** if children include absolutely-positioned popovers, they will be clipped. Use `position: fixed` for popovers (compute coords from trigger's bounding rect) so they escape the scroll container.

---

## 11. Backgrounds

| Layer | Treatment |
|---|---|
| Page canvas | `bg-cream-50` |
| Card / surface | `bg-white` (default) or `bg-cream-100` (recessed) |
| Glass panel | `bg-white/85` + `backdrop-filter: blur(10–12px)` — only on sticky pagination bar and over-image chips |
| Loading veil | `bg-cream-100/70` over the area being updated |
| Annotation page | dotted grid + sky radial blobs (see §7 AnnotationPage) |

Never use pure white (`#FFFFFF`) as a page canvas — use `cream/50`. White is for cards on top of cream.

---

## 12. Tailwind tokens snippet

`tailwind.config.ts` (relevant excerpt):

```ts
theme: {
  extend: {
    colors: {
      cream:  { 50: '#FAFAFA', 100: '#F9F8F8', 200: '#F4F1EE', 300: '#F1EBE5' },
      sand:   { 200: '#EDDFD0', 300: '#F4E6DA' },
      stone:  { 100: '#EDEFF0', 200: '#E4E2E2' },
      sky:    { 50: '#F0F6FF', 100: '#E9EFFF', 200: '#E2ECF5', 300: '#A7CBF2',
                400: '#9CC1E7', 500: '#84B9EF', 600: '#6F86FF', 700: '#156CC2' },
      ink:    { 400: '#616161', 500: '#757170', 600: '#614A44',
                700: '#453F3D', 800: '#151313', 900: '#1A1615' },
      success:{ 600: '#0EA158', 700: '#118647', 800: '#168804' },
      warning:{ 600: '#CF8D13' },
      danger: { 600: '#C9502E' },
      warmth: { 600: '#754D29' },
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      mono: ['"Fragment Mono"', 'ui-monospace', 'monospace'],
    },
    letterSpacing: {
      eyebrow: '0.06em',
    },
  },
}
```

---

## 13. Pre-delivery checklist

Before merging a screen / component:

- [ ] Page canvas is `cream/50` — never pure white
- [ ] Eyebrow labels are mono uppercase `text-[10px] tracking-eyebrow text-ink-500`
- [ ] All interactive controls are ≥ 36×36 (we use `h-9` / `h-11`) and have a visible `active:scale-[0.96–0.98]` state
- [ ] Focus-visible ring uses `sky-600` or `sky-700`, with `ring-offset-cream-50` on cream backgrounds
- [ ] No `position: absolute` popovers inside an `overflow-x: auto` ancestor — use `fixed` + computed rect
- [ ] One primary CTA per surface — only one element uses `bg-ink-900 text-white` or a glow gradient
- [ ] Status / signal color is paired with text or icon, never color-only
- [ ] Long strings are `truncate`-d in lists / cards
- [ ] `aria-hidden="true"` on decorative SVGs; `aria-label` / `aria-pressed` / `aria-live` on stateful controls
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Counts / page numbers use `tabular-nums`
- [ ] Tinted shadow (warm or cool) + inset top sheen — no flat grey drop shadows
Here's the snippet pulled from design.md covering backgrounds, gradients, and the dropdown pattern:

---
Backgrounds (design.md:330-340)

┌──────────────┬────────────────────────────────────────────────────────────────┐
│    Layer     │                           Treatment                            │
├──────────────┼────────────────────────────────────────────────────────────────┤
│ Page canvas  │ bg-cream-50                                                    │
├──────────────┼────────────────────────────────────────────────────────────────┤
│ Card /       │ bg-white (default) or bg-cream-100 (recessed)                  │
│ surface      │                                                                │
├──────────────┼────────────────────────────────────────────────────────────────┤
│ Glass panel  │ bg-white/85 + backdrop-filter: blur(10–12px) — only on sticky  │
│              │ pagination bar and over-image chips                            │
├──────────────┼────────────────────────────────────────────────────────────────┤
│ Loading veil │ bg-cream-100/70 over the area being updated                    │
├──────────────┼────────────────────────────────────────────────────────────────┤
│ Annotation   │ dotted grid + sky radial blobs                                 │
│ page         │                                                                │
└──────────────┴────────────────────────────────────────────────────────────────┘

Never use pure white (#FFFFFF) as a page canvas — use cream/50. White is for cards on top of cream.

Annotation page background (design.md:272): dotted grid + radial sky blobs weighted to the bottom — radial-gradient(circle, #DCD9D5 1px, transparent 1.5px) at 22×22px, layered over sky-colored ellipses.

---
Gradients — Glow CTAs (design.md:58-71)

/* Royal sky (Continue annotating) */
background:
  radial-gradient(ellipse 110% 80% at 50% 0%, rgba(255,255,255,0.22) 0%, transparent 60%),
  linear-gradient(180deg, #3B82F6 0%, #2563EB 100%);

/* Royal purple (Confirm audited) */
background:
  radial-gradient(ellipse 110% 80% at 50% 0%, rgba(255,255,255,0.22) 0%, transparent 60%),
  linear-gradient(180deg, #8B5CF6 0%, #7C3AED 100%);

Each pairs with inset 0 1px 0 rgba(255,255,255,0.45) (top sheen) and inset 0 -1px 1px rgba(0,0,0,0.14) (bottom edge) for tactile depth without an outer drop shadow.

Directional intent gradients on swipe (design.md:274): danger-600 left, success-700 right and up; opacity tracks drag distance (Math.min(1, dragX / 140)).

---
Dropdown panel (design.md:204-213)

fixed z-50 w-56 / w-72 rounded-lg bg-white border border-stone-200 overflow-hidden
box-shadow: 0 18px 45px rgba(60,120,190,0.12), 0 4px 50px rgba(97,74,68,0.10)

- position: fixed, not absolute — escapes any ancestor overflow clipping
- Position computed from trigger's getBoundingClientRect(): left: rect.left, top: rect.bottom + 8
- Inner search input: h-9 rounded-full bg-cream-100 border-transparent; focus → border-sky-700 bg-white
- Option row: px-3 py-2 flex items-center gap-3 hover:bg-cream-100 with transition-colors duration-100
- Footer "Clear N selected": border-t border-stone-200 bg-cream-50, mono eyebrow, hover → text-danger-600

---
If you wanted me to write this into a new file (e.g., a condensed design-snippet.md) rather than display it here, let me know where.