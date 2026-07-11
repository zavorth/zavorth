# Zavorth Desktop — Quality Bar

Checklist for shipping desktop polish. Structural automation lives in
`npm run check:quality`. Unit tests: `npm run test`.

## Automated gates

| Command | Covers |
| --- | --- |
| `npm run check` | Production Vite build |
| `npm run check:shell` | Shell v1 structure markers |
| `npm run check:quality` | Polish artifacts, brand, a11y markers, IA, virtual file tree |
| `npm run test` | Unit tests (onboarding, message window, file tree virtual, readiness, nav, quality, parity doc) |
| `npm run test:all` | Unit + electron unit |
| `npm run check:visual` | Playwright Electron screenshots (shell, chat, busy, review, approval-card, proof, settings, density) |
| `npm run check:a11y` | axe-core scan on Electron surfaces (serious/critical fail) + Review soft name check |
| `npm run check:all` | build + shell + quality + unit tests |
| `npm run check:ci` | `check:all` + visual + a11y |

### Visual baselines

- Artifacts: `tests/visual/artifacts/`
- Baselines: `tests/visual/baselines/`
- First run seeds baselines. Update with:

```bash
npm run check:visual -- --update
# or
ZAVORTH_VISUAL_UPDATE=1 npm run check:visual
```

Diff threshold: `ZAVORTH_VISUAL_MAX_DIFF` (default `0.02` = 2% pixels).

### a11y

- Report: `tests/a11y/artifacts/a11y-summary.json`
- Fails on **critical** / **serious** by default
- Include moderate: `ZAVORTH_A11Y_INCLUDE_MODERATE=1 npm run check:a11y`
- Skip link presence is always checked
- Review surface: soft check that approve/reject buttons (when rendered) expose accessible names
- **Screen-reader path for Review is partially automated** — axe + name soft-check cover structure; full NVDA/VoiceOver pass on approve/reject flow remains manual

## Visual / regression surfaces

1. **Shell** — chat-first layout (`shell-chat`)
2. **Chat empty** — Kael hero / thread region (`chat-empty`)
3. **Composer busy** — status stack / busy chrome (`composer-busy`)
4. **Review hub** — Approvals + Learning (`review-hub`)
5. **Approval card** — review list card surface (`approval-card`)
6. **Proof timeline** — receipts (`proof-timeline`)
7. **Settings** — panel/overlay (`settings`)
8. **Density compact** — `.density-compact` shell (`density-compact`)

Manual extras when shipping a heavy visual PR: light/dark, comfortable/compact side-by-side, Command Center, onboarding steps, offline banner.

## a11y checklist

- [x] Skip link to main content (`zvd-skip-link`)
- [x] `:focus-visible` on controls / buttons / tabs
- [x] `prefers-reduced-motion` zeros motion tokens
- [x] Command palette + Command Center keyboard open/close
- [x] Automated axe scan on Electron (`npm run check:a11y`)
- [x] Review approve/reject accessible-name soft check (when cards present)
- [ ] Full screen-reader pass on Review approve/reject (manual — partially automated)

## Performance checklist

- [x] Message windowing for long threads (`messageWindow.ts`, default 80)
- [x] Lazy-loaded secondary workspace panels
- [x] Tool cards collapsed by default
- [x] Virtualized file tree (`fileTreeVirtual.ts` + `VirtualFileTree`) for large workspaces
- [x] Streaming isolation (`streamIsolation.ts` — frozen vs live message slice)

## Agent IDE polish

- [x] Composer status stack (`composerStatus` + `ComposerStatusStack`)
- [x] Context meter on composer (`contextMeter` + `ContextMeterBar`)
- [x] Queue while busy + auto-dequeue (`composerQueue` + shell wiring)
- [x] Per-session drafts (`composerDrafts`)
- [x] Plan card in-thread (`planCard` + `PlanCardView`)
- [x] Open-from-chat → files/diff rail (`openFromChat` + `ToolCallBlock` + shell)
- [x] Session chrome rename/pin/archive (`sessionChrome` + sidebar menu)
- [x] Review rail model + ship bar (`reviewRailModel` + git rail)
- [x] Terminal multi-tab + agent activity (`terminalTabs` + `TerminalTabsPanel`)
- [x] Capability constellation overlay (`constellationLayout` + `ConstellationOverlay`) — visual domain map; domain hubs stay overlays, not 20 nav pages

## Trust and review surfaces

- [x] Trusted operator storage + topbar badge toggle (`trustedOperator` + `.zvd-trust-badge`)
- [x] Hunk review card (`hunkApproval` + `HunkReviewCard`)
- [x] Run timeline (`runTimeline` + `RunTimeline`)
- [x] Agent strip (`agentStrip` + `AgentStrip`)
- [x] Domain wizards (`domainWizards` + `DomainWizardOverlay`)

## Visual automation coverage

- [x] Expanded visual scenes: shell-chat, chat-empty, composer-busy, review-hub, approval-card, proof-timeline, settings, density-compact
- [x] First visual run seeds baselines under `tests/visual/baselines/`
- [x] Structural parity doc test (`tests/parityDoc.test.ts`)

## Density QA

- [x] `density-comfortable` / `density-compact` tokens
- [x] Control height / sidebar width scale with density
- [x] Visual scene for compact density (`density-compact`)
- [ ] Manual pixel check topbar + composer both densities

## Brand QA

- [x] Accent seed `#00e88f`, dark seed `#060809`
- [x] Kael mascot on empty chat
- [x] No third-party agent product names in polish UI strings
- [x] Status badges: Live / Needs setup / Available / Blocked (catalog ≠ live)
- [x] Ready/Live requires `liveReady === true` proof boolean (status-only never grants live)

## Definition of done for a visual PR

1. `npm run check && npm run check:shell && npm run check:quality && npm run test` pass
2. `npm run check:visual` pass (or baselines updated deliberately with `--update`)
3. `npm run check:a11y` pass (no serious/critical)
4. Reduced-motion smoke: OS setting on, no endless spinners fighting the user
5. Keyboard: Tab to composer, Esc closes overlays, Ctrl+K palette, Ctrl+Shift+K Command Center
