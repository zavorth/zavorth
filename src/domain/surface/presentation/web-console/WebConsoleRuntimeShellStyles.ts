export function buildRuntimeShellStyles(): string {
  return `:root {
  color-scheme: light;
  --bg: #f4f4ef;
  --surface: #ffffff;
  --text: #171717;
  --muted: #5c5b57;
  --border: #dbd7cf;
  --accent: #0f6c5c;
  --accent-soft: #dff2eb;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  font-family: "Segoe UI", "Inter", sans-serif;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(15, 108, 92, 0.09), transparent 28%),
    linear-gradient(180deg, #f8f6f1 0%, var(--bg) 100%);
}

.runtime-handoff-shell {
  width: min(960px, calc(100% - 32px));
  margin: 0 auto;
  padding: 32px 0 48px;
}

.legacy-containment-banner,
.canonical-containment-banner {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding: 14px 16px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 12px 28px rgba(31, 29, 24, 0.06);
  color: var(--muted);
}

.legacy-containment-banner strong,
.canonical-containment-banner strong {
  color: var(--text);
  white-space: nowrap;
}

.legacy-containment-banner a,
.canonical-containment-banner a {
  color: var(--accent);
  font-weight: 700;
  white-space: nowrap;
}

.legacy-containment-banner {
  border-color: rgba(181, 115, 38, 0.35);
  background: rgba(255, 246, 226, 0.86);
}

.hero-card,
.handoff-card {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: 0 18px 40px rgba(31, 29, 24, 0.08);
}

.hero-card {
  padding: 28px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--accent);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-card h1,
.handoff-card h2 {
  margin: 0;
}

.hero-copy,
.muted-copy {
  color: var(--muted);
  line-height: 1.6;
}

.section-note {
  margin-top: 10px;
}

.hero-note {
  margin-top: 16px;
}

.status-grid,
.handoff-grid,
.profile-grid {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}

.status-grid {
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.handoff-grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  margin-top: 16px;
}

.profile-grid {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.priority-profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.ops-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.cockpit-summary-grid {
  margin-top: 18px;
}

.status-pill {
  padding: 16px;
  border-radius: 18px;
  background: var(--accent-soft);
  border: 1px solid rgba(15, 108, 92, 0.16);
}

.status-pill .label {
  display: block;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 0.85rem;
}

.handoff-card {
  padding: 22px;
  margin-top: 16px;
}

.handoff-card.card-focus {
  border-color: rgba(15, 108, 92, 0.28);
  background: rgba(223, 242, 235, 0.9);
  box-shadow: 0 18px 40px rgba(15, 108, 92, 0.12);
}

.handoff-card.card-subtle {
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 14px 30px rgba(31, 29, 24, 0.05);
}

.priority-card,
.handoff-card:first-of-type {
  position: relative;
}

.priority-actions {
  margin-top: 18px;
}

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

.compact-remote-actions {
  margin-top: 14px;
}

.inline-action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.inline-choice-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.inline-choice-button {
  margin-top: 0;
}

.inline-choice-button.is-active {
  background: var(--accent);
  color: #ffffff;
  border-color: var(--accent);
}

.muted-inline {
  color: var(--muted);
}

.auth-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 16px;
}

.hero-actions {
  margin-top: 22px;
}

.action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  background: var(--accent);
  color: #ffffff;
  text-decoration: none;
  font-weight: 600;
  border: 1px solid transparent;
  cursor: pointer;
  font: inherit;
}

.action-button.secondary {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
}

.compact-action {
  margin-top: 12px;
  min-height: 40px;
  padding: 0 14px;
}

.auth-input {
  flex: 1 1 320px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.92);
  color: var(--text);
  font: inherit;
}

.handoff-list {
  margin: 16px 0 0;
  padding-left: 18px;
  line-height: 1.8;
}

.handoff-list.compact {
  margin-top: 12px;
  line-height: 1.65;
}

.inline-diff-preview {
  max-height: 260px;
  overflow: auto;
  margin: 10px 0 0;
  padding: 12px;
  border-radius: 14px;
  background: rgba(10, 30, 26, 0.92);
  color: #d6fff3;
  border: 1px solid rgba(15, 108, 92, 0.22);
  white-space: pre-wrap;
}

.profile-card {
  padding: 18px;
  border-radius: 20px;
  background: rgba(248, 246, 241, 0.84);
  border: 1px solid rgba(15, 108, 92, 0.08);
}

.priority-profile-card {
  padding: 16px;
  border-radius: 18px;
  background: rgba(248, 246, 241, 0.72);
  border: 1px solid rgba(15, 108, 92, 0.1);
}

.ops-summary-card {
  padding: 16px;
  border-radius: 18px;
  background: rgba(248, 246, 241, 0.72);
  border: 1px solid rgba(15, 108, 92, 0.1);
}

.cockpit-mini-card {
  min-height: 132px;
}

.ops-summary-card.card-focus {
  border-color: rgba(15, 108, 92, 0.28);
  background: rgba(223, 242, 235, 0.9);
  box-shadow: 0 16px 34px rgba(15, 108, 92, 0.12);
}

.ops-summary-card.card-subtle {
  background: rgba(255, 255, 255, 0.72);
}

.action-rail {
  margin-top: 18px;
}

.ops-detail-panel {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(15, 108, 92, 0.1);
}

.system-overlord-card {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(239, 247, 242, 0.86)),
    radial-gradient(circle at top right, rgba(15, 108, 92, 0.12), transparent 34%);
}

.system-overlord-grid {
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
}

.system-overlord-detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.system-overlord-action-form {
  display: grid;
  grid-template-columns: minmax(140px, 0.9fr) minmax(120px, 0.75fr) minmax(110px, 0.65fr) minmax(220px, 1.6fr);
  gap: 10px;
  align-items: center;
  margin-top: 16px;
}

.system-overlord-detail-card {
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(15, 108, 92, 0.1);
}

.compact-select {
  min-width: 0;
}

.inline-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-weight: 600;
}

.priority-profile-card strong {
  display: block;
  margin-top: 6px;
  line-height: 1.5;
}

.ops-summary-card strong {
  display: block;
  margin-top: 6px;
  line-height: 1.5;
}

.profile-card h3 {
  margin: 0;
  font-size: 1.05rem;
}

.profile-card p {
  margin: 10px 0 0;
  color: var(--muted);
  line-height: 1.55;
}

.profile-tag {
  margin: 0 0 10px;
  color: var(--accent);
  font-size: 0.76rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

code {
  padding: 2px 6px;
  border-radius: 8px;
  background: #f0eee8;
  font-family: "Consolas", "SFMono-Regular", monospace;
  font-size: 0.92em;
}

@media (max-width: 640px) {
  .runtime-handoff-shell {
    width: min(100%, calc(100% - 20px));
    padding: 20px 0 32px;
  }

  .hero-card,
  .handoff-card {
    border-radius: 20px;
    padding: 20px;
  }

  .action-row {
    flex-direction: column;
  }

  .system-overlord-action-form {
    grid-template-columns: 1fr;
  }
}`;
}
