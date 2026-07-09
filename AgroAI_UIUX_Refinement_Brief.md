# AgroAI — UI/UX Refinement Brief

**Role:** You are a UI/UX engineer refining an existing crop-monitoring web app called **AgroAI**. The core functionality already works — this is a **visual polish pass only**, focused on spacing, color contrast, and typography. Do not change any logic, data, or functionality.

---

## Scope

Apply changes to these **three pages only**:

1. Add New Field page
2. Crop Management page
3. Crop Report page

**Do not touch the Dashboard page layout or element positions** — those are final and approved. The only exception is the chatbot panel color/font review noted at the end of this doc.

---

## 1. Spacing & Alignment

- Remove the large gap currently sitting between the navbar and the page content on all three pages. Standardize top padding to **24–32px**.
- Align all cards, headers, and sections into a consistent grid — match the spacing rhythm already used correctly on the Dashboard.
- Keep consistent vertical spacing (**16–20px**) between section headers (e.g. "1. Name your field") and their content blocks.
- Card padding should be uniform: **20–24px** inside every card, on every page.

---

## 2. Color System

Current issue: too much green-on-green and green-on-white with weak contrast (light green tags on white cards, green text on pale green backgrounds).

### Core Palette

| Role | Color | Hex | Usage |
|---|---|---|---|
| Primary Green (brand) | Forest Green | `#1E7A34` | Primary buttons, active nav state, key highlights |
| Primary Green Hover | Deep Green | `#155C27` | Hover/active state for primary buttons |
| Text — Primary | Charcoal | `#1A1F1C` | Headings, body text, field labels |
| Text — Secondary | Slate Gray | `#5C6B63` | Helper text, sub-labels, descriptions |
| Accent (complementary) | Muted Teal | `#2A7D82` | Links, secondary highlights, chart accents, focus rings |
| Background — Page | Off-White | `#F7F9F7` | Page background |
| Background — Card | Pure White | `#FFFFFF` | Cards, panels |
| Border — Default | Light Gray | `#D9E0DB` | Card borders, input borders |
| Status — Warning | Amber | `#E8A33D` on `#FCEFD9` bg | "Possible water stress" pill |
| Status — Danger | Red | `#D64545` on `#FBE2E2` bg | "Needs attention" pill |
| Status — Neutral | Slate Purple | `#7C7FA6` on `#EDEDF6` bg | "No clear imagery" pill |
| Status — Success | Green | `#1E7A34` on `#E3F2E5` bg | "Worth a look" / healthy indicators |

**Why teal as the complementary accent:** Green + teal sit next to each other on the color wheel (both cool tones) but teal is distinct enough to separate "action/accent" elements from "brand/success" elements — so users don't confuse a link or focus ring with a "healthy crop" indicator. All pairings above meet **WCAG AA (4.5:1)** contrast for text.

---

## 3. Buttons — Exact Mapping

| Button | Type | Background | Text Color | Border | Hover State |
|---|---|---|---|---|---|
| **+ Add field** (navbar) | Primary | `#1E7A34` | White `#FFFFFF` | none | Background → `#155C27` |
| **Save field** | Primary | `#1E7A34` | White `#FFFFFF` | none | Background → `#155C27`, subtle shadow |
| **Refresh satellite** | Primary | `#1E7A34` | White `#FFFFFF` | none | Background → `#155C27` |
| **Cancel** | Secondary | Transparent | Charcoal `#1A1F1C` | 1px `#D9E0DB` | Background → `#F1F3F1` |
| **Undo last** | Secondary | Transparent | Charcoal `#1A1F1C` | 1px `#D9E0DB` | Background → `#F1F3F1` |
| **Clear all** | Destructive-secondary | Transparent | `#D64545` | 1px `#F3C9C9` | Background → `#FBE2E2` |
| **Send** (chatbot) | Primary | `#1E7A34` | White `#FFFFFF` | none | Background → `#155C27` |
| Field filter tabs (Satellite / Greenness / Chlorophyll / Water stress) | Toggle | Inactive: `#FFFFFF`, Active: `#1E7A34` | Inactive: Charcoal, Active: White | 1px `#D9E0DB` on inactive | Inactive hover → `#F1F3F1` |

**Rule of thumb:** Green fill = the one primary action per screen. Everything else (cancel, undo, secondary navigation) stays neutral/outlined so the primary action visually stands out. Destructive actions (Clear all) get a red accent, never green or gray.

---

## 4. Input Boxes

| State | Border | Background | Text |
|---|---|---|---|
| Default | 1px `#D9E0DB` | `#FFFFFF` | Charcoal `#1A1F1C` |
| Placeholder text | — | — | Slate Gray `#5C6B63` |
| Focus | 2px `#2A7D82` (teal ring) | `#FFFFFF` | Charcoal `#1A1F1C` |
| Disabled | 1px `#E5E9E6` | `#F7F9F7` | `#A6ADA8` |
| Error | 1px `#D64545` | `#FFFFFF` | Charcoal, error text in `#D64545` below field |

Dropdowns (e.g., Crop selector) follow the same input styling, with a chevron icon in Slate Gray.

---

## 5. Typography

- **Font family:** `Inter` (primary choice) or `Manrope` (alternative) — both are clean, highly legible sans-serifs well suited to data-dense dashboards.
- **Hierarchy:**

| Element | Size | Weight |
|---|---|---|
| Page/section titles ("ADD NEW FIELD", "CROP MANAGEMENT") | 13–14px, uppercase, letter-spacing 0.5px | Semibold (600) |
| Step headers ("1. Name your field") | 18–20px | Semibold (600) |
| Card titles (field names, "GIS_02") | 16–18px | Semibold (600) |
| Body text / descriptions | 14–15px | Regular (400) |
| Labels (Field name, Crop) | 13–14px | Medium (500) |
| Status pill text | 12–13px | Medium (500) |

- Keep line-height at **1.4–1.5x** font size for readability.
- No emoji anywhere — replace any decorative emoji-style icons with simple line icons (e.g., Lucide or Feather icon set) in Slate Gray or the relevant status color.

---

## 6. Consistency Rules Across Pages

- All cards: same corner radius (**12px**), same shadow (`0px 1px 3px rgba(0,0,0,0.08)`), same internal padding (20–24px).
- Status pills: same shape (pill/rounded-full), same padding (6px 12px), same icon + text spacing across all three pages.
- Navbar stays exactly as-is (already approved) — just ensure the active-tab highlight color matches the new primary green.

---

## 7. Transitions

- All hover/focus/active state changes: **150–200ms ease-in-out**.
- No abrupt color snaps — background and border transitions should fade smoothly.
- Modal/panel open-close (e.g., Add Field flow) can use a simple fade + slight upward slide (200–250ms).

---

## 8. Special Note — Dashboard Chatbot Panel

**Do not change the Dashboard's layout or element positions.** However, review the **chatbot panel** (left sidebar, pale mint-green background with chat bubbles) specifically for:

- Whether the mint-green background (`~#E8F5EA`-ish tone) gives enough contrast against the white chat bubble and Slate Gray helper text.
- Whether the current font in chat messages matches the new Inter/Manrope system, or looks mismatched/inconsistent.

**If contrast or font is a problem, fix it** using the palette and font rules above (e.g., darken the mint background slightly, or switch chat text to Charcoal `#1A1F1C` for stronger readability) — but do not move, resize, or reposition the chatbot panel or its input box.

Include a **one-line note** in your delivery explaining exactly what was changed in the chatbot panel and why.

---

## Deliverable Checklist

- [ ] Spacing/gap fixed on Add Field, Crop Management, Crop Report pages
- [ ] Color palette applied consistently (per table above)
- [ ] Buttons follow primary/secondary/destructive mapping exactly
- [ ] Input boxes follow default/focus/error states
- [ ] Font updated to Inter or Manrope with defined hierarchy
- [ ] No emojis anywhere in the UI
- [ ] Transitions smoothed to 150–200ms
- [ ] Dashboard layout untouched — confirm in writing
- [ ] Chatbot panel contrast/font reviewed — note included if changed
