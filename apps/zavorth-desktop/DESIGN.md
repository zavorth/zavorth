# Zavorth Desktop — Design System

Brand reference: [docs/brand-guide.md](../../docs/brand-guide.md)
Tokens: `src/styles/design-system.css` · `src/designSystem/desktopTokens.ts`
Primitives: `src/primitives/ui.tsx`

---

## Principles

### 1. Flat, not boxed
Prefer whitespace, hairlines, and soft surface shifts over nested cards. Avoid card-in-card chrome. Use elevation sparingly (overlays, popovers) — not for every list item.

### 2. Tokens only
Colors, spacing, type, radius, motion, and elevation come from CSS variables (`--zvd-*`). Components do not hardcode hex for surfaces or brand. Seeds (`--zvd-seed-*`) may be overridden by theme presets; everything else derives from tokens.

### 3. One primitive per concern
Use a single shared primitive for each UI job:

| Concern | Primitive | Class root |
| --- | --- | --- |
| Action | `Button` / `IconButton` | `.zvd-btn` / `.zvd-icon-btn` |
| List item | `ListRow` | `.zvd-list-row` |
| Search | `SearchField` | `.zvd-search-field` |
| Segmented choice | `SegmentedControl` | `.zvd-segmented` |
| Empty | `EmptyState` | `.zvd-empty` |
| Error | `ErrorState` | `.zvd-error` |
| Loading | `Loader` | `.zvd-loader` |
| Status chip | `Badge` / `StatusBadge` | `.zvd-badge` |
| Shortcut key | `Kbd` | `.zvd-kbd` |

Do not invent one-off buttons or empty panels when a primitive already covers the case.

### 4. Kael brand
| Token role | Value |
| --- | --- |
| Zavorth green | `#00e88f` |
| Dark / void | `#060809` |

Kael (fox mascot) appears in empty/onboarding moments — calm, competent, not flashy. Kael is the face; Zavorth is the agent. Avoid mascot noise on trust-critical surfaces (approvals, receipts).

### 5. Reduced motion
Respect `prefers-reduced-motion`. Motion tokens (`--zvd-motion-fast|normal|slow`) default to ~120–280ms. Under reduced motion, animations and transitions collapse; decorative loops (e.g. Kael breathe) stop.

### 6. Catalog ≠ live
A cataloged channel, skill, provider, or backend is **not** the same as live-ready.

| Badge | Meaning |
| --- | --- |
| **Live** | Proven ready (credentials + test / health) |
| **Needs setup** | Supported path but not configured |
| **Available** | Catalog support only — not proven live |
| **Blocked** | Hard stop (policy, missing capability) |

Never label catalog entries as “ready” without a live signal. `StatusBadge` and readiness helpers enforce this distinction.

- **Ready/Live requires live proof boolean** (`liveReady === true`). Status strings alone (`ready`, `available`, `ok`, `healthy`, `active`, even `live`/`connected`) never grant Live.

### 7. Density
Two densities via `.zvd-app.density-compact` (and `comfortable` default). Density retunes control height, type base, sidebar width, and spacing — not a separate component tree.

### 8. Primary nav slim
Primary sidebar nav (`.zvd-sidebar-nav-primary`) holds ~6 first-class items max (chat, review, proof, projects, overflow). Secondary destinations use `.zvd-nav-secondary-link` or Command Center / overlays.

### 9. Chat home trust loop
Daily home is **Thread + Next Action + Proof strip** (not a metrics dashboard). Primary CTA path: review approvals → open proof (receipts). Preferred keys when shortcuts gain panel bindings: **R** or `g p` for proof; until then use sidebar Proof, Command Center, or the strip CTA.

---

## Type scale

| Token | Typical use |
| --- | --- |
| `--zvd-text-xs` | Badges, kbd, meta |
| `--zvd-text-sm` | Secondary labels, captions |
| `--zvd-text-md` | Body / controls (default) |
| `--zvd-text-lg` | Section titles |
| `--zvd-text-xl` | Page / empty heroes |

Base app size remains `--zvd-font-size` (density-aware). Prefer scale tokens for component typography.

## Elevation

| Token | Use |
| --- | --- |
| `--zvd-shadow` | Soft panel lift |
| `--zvd-shadow-overlay` | Modal / palette |
| `--zvd-shadow-elevation` | Structured multi-layer elevation |
| `--zvd-stroke-hairline` | Flat separators (prefer over heavy borders) |
| `.zvd-overlay-hairline` | 1px top hairline for overlays |

## Motion

| Token | Default |
| --- | --- |
| `--zvd-motion-fast` | 120ms |
| `--zvd-motion-normal` | 180ms |
| `--zvd-motion-slow` | 280ms |

Use for hover/focus fades and short UI transitions. No bouncing or long decorative motion on productivity surfaces.

## Focus & a11y

- Focus ring: `--zvd-focus-ring` (accent-derived)
- Interactive controls expose `:focus-visible`
- Skip link: `.zvd-skip-link`
- Loader / empty / error expose appropriate `role` / `aria-*` in primitives

## Do / Don’t

**Do**
- Compose with primitives + tokens
- Keep primary CTAs on accent green
- Mark readiness honestly (catalog vs live)
- Prefer flat rows and hairlines

**Don’t**
- Nest bordered cards three deep
- Hardcode brand colors in components
- Duplicate Button/ListRow with local CSS
- Ship emoji-heavy empty states as the only design (optional icon node is fine)
- Imply live readiness from catalog presence alone
