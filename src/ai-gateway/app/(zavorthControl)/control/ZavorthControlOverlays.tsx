import type { ReactNode } from "react";
import {
  IconBook,
  IconSearch,
  IconSettings,
  IconStar,
} from "./ZavorthControlIcons";

function IconClose({ width = 24, height = 24 }: { width?: number; height?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={width} height={height} stroke="currentColor" fill="none" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function IconAttach() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function IconMedia() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function IconMonitor() {
  return (
    <svg viewBox="0 0 24 24">
      <rect x="2" y="4" width="20" height="14" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 18v2" />
    </svg>
  );
}

function IconTerminal() {
  return (
    <svg viewBox="0 0 24 24">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path d="M19 10v2a7 7 0 01-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function IconPulse() {
  return (
    <svg viewBox="0 0 24 24">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function ToolSheetItem({
  action,
  children,
  icon,
  wide = false,
}: {
  action: string;
  children: ReactNode;
  icon: ReactNode;
  wide?: boolean;
}) {
  return (
    <button
      className={`tool-sheet__item${wide ? " tool-sheet__item--wide" : ""}`}
      type="button"
      data-tool-sheet-action={action}
    >
      <span className="tool-sheet__icon">{icon}</span>
      <span>{children}</span>
    </button>
  );
}

export function ZavorthControlToolSheet() {
  return (
    <section
      className="tool-sheet hidden"
      id="tool-sheet"
      role="dialog"
      aria-modal="true"
      aria-hidden="true"
      aria-labelledby="tool-sheet-title"
    >
      <div className="tool-sheet__handle" />
      <div className="tool-sheet__header">
        <div>
          <div className="tool-sheet__eyebrow">Zavorth tools</div>
          <h2 className="tool-sheet__title" id="tool-sheet-title">
            Choose what Zavorth can use
          </h2>
        </div>
        <button className="tool-sheet__close" id="tool-sheet-close" type="button" aria-label="Close tools">
          <IconClose />
        </button>
      </div>
      <div className="tool-sheet__grid" aria-label="Request tools">
        <ToolSheetItem action="attach" icon={<IconAttach />}>
          <strong>Files</strong>
          <small>Attach context to this request</small>
        </ToolSheetItem>
        <ToolSheetItem action="media" icon={<IconMedia />}>
          <strong>Media</strong>
          <small>Add image, video, or audio</small>
        </ToolSheetItem>
        <ToolSheetItem action="mcp" icon={<IconMonitor />}>
          <strong>Remote action</strong>
          <small>Prepare preview and approval</small>
        </ToolSheetItem>
        <ToolSheetItem action="docs" icon={<IconBook />}>
          <strong>Docs</strong>
          <small>Use project knowledge safely</small>
        </ToolSheetItem>
        <ToolSheetItem action="terminal" icon={<IconTerminal />}>
          <strong>Safe terminal</strong>
          <small>Explain command before running</small>
        </ToolSheetItem>
        <ToolSheetItem action="skills" icon={<IconStar />}>
          <strong>Tools</strong>
          <small>Select a capability</small>
        </ToolSheetItem>
        <ToolSheetItem action="voice" icon={<IconMic />} wide>
          <strong>Voice</strong>
          <small>Speak a task to Zavorth</small>
        </ToolSheetItem>
      </div>
    </section>
  );
}

export function ZavorthControlCommandPalette() {
  return (
    <div id="cmd-palette">
      <div className="cmd-palette__input-frame">
        <IconSearch width={20} height={20} />
        <input type="text" className="cmd-palette__input" placeholder="Search commands, agents, files..." id="cmd-input" />
      </div>
      <div className="cmd-palette__results">
        <div className="cmd-palette__group-label">Suggested Actions</div>
        <div className="cmd-palette__item selected">
          <IconLayers /> Add New Agent
        </div>
        <div className="cmd-palette__item">
          <IconPulse /> Start Health Check
        </div>
        <div className="cmd-palette__item">
          <IconSettings /> Open Settings
        </div>
      </div>
    </div>
  );
}

export function ZavorthControlModal() {
  return (
    <div className="core-modal" id="core-modal">
      <div className="core-modal__header">
        <h3 className="core-modal__title" id="core-modal-title">
          Title
        </h3>
        <button className="core-modal__close" id="core-modal-close">
          <IconClose width={20} height={20} />
        </button>
      </div>
      <div className="core-modal__body" id="core-modal-body">
        Modal content.
      </div>
      <div className="core-modal__footer" id="core-modal-footer">
        <button className="core-btn" id="core-modal-cancel">
          Cancel
        </button>
        <button className="core-btn core-btn--primary" id="core-modal-confirm">
          Confirm
        </button>
      </div>
    </div>
  );
}

export function ZavorthControlBootGate() {
  return (
    <div id="boot-gate">
      <div className="boot-gate__brand">
        <div className="boot-gate__logo">
          <svg viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="url(#blg2)" />
            <path
              d="M16 6L24 12V20L16 26L8 20V12L16 6Z"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="1.5"
              fill="none"
            />
            <circle cx="16" cy="16" r="3" fill="#00ffaa" opacity="0.9" />
            <path d="M16 13V10M16 19V22M13 16H10M19 16H22" stroke="#00ffaa" strokeWidth="1" opacity="0.5" />
            <defs>
              <linearGradient id="blg2" x1="0" y1="0" x2="32" y2="32">
                <stop stopColor="#0a2f1f" />
                <stop offset="1" stopColor="#0d1b14" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="boot-gate__status" id="boot-status">
          <div className="boot-spinner" />
          Connecting to the core...
        </div>
      </div>
    </div>
  );
}

export function ZavorthControlTraceSheet() {
  return (
    <section
      className="trace-sheet hidden"
      id="trace-sheet"
      role="dialog"
      aria-modal="true"
      aria-hidden="true"
      aria-labelledby="trace-sheet-title"
    >
      <div className="trace-sheet__handle" />
      <div className="trace-sheet__header">
        <div>
          <div className="trace-sheet__eyebrow">History</div>
          <h2 className="trace-sheet__title" id="trace-sheet-title">
            Recent activity
          </h2>
        </div>
        <button className="trace-sheet__close" id="trace-sheet-close" type="button" aria-label="Close history">
          <IconClose />
        </button>
      </div>
      <div className="trace-sheet__stats" aria-label="Trace summary">
        <div>
          <strong id="trace-step-count">0</strong>
          <span>Steps</span>
        </div>
        <div>
          <strong id="trace-approval-count">0</strong>
          <span>Approvals</span>
        </div>
        <div>
          <strong id="trace-receipt-count">0</strong>
          <span>Receipts</span>
        </div>
      </div>
      <div className="trace-sheet__timeline" id="trace-sheet-timeline" aria-live="polite">
        <div className="trace-sheet__empty">
          <span className="trace-sheet__empty-dot" />
          <strong>Waiting for activity</strong>
          <small>Send a mission to inspect the runtime from inside.</small>
        </div>
      </div>
    </section>
  );
}

function DrawerItem({
  active = false,
  children,
  sector,
}: {
  active?: boolean;
  children: ReactNode;
  sector: string;
}) {
  return (
    <button className={`mobile-drawer__item${active ? " active" : ""}`} type="button" data-drawer-sector={sector}>
      {children}
    </button>
  );
}

export function ZavorthControlMobileDrawer() {
  return (
    <aside className="mobile-drawer" id="mobile-drawer" aria-hidden="true">
      <div className="mobile-drawer__header">
        <div>
          <div className="mobile-drawer__eyebrow">Zavorth Home</div>
          <div className="mobile-drawer__title">Zavorth</div>
        </div>
        <button className="mobile-drawer__close" id="mobile-drawer-close" type="button" aria-label="Close menu">
          <IconClose />
        </button>
      </div>
      <nav className="mobile-drawer__nav" aria-label="Main navigation">
        <DrawerItem active sector="terminal">
          Inbox
        </DrawerItem>
        <DrawerItem sector="overview">Work</DrawerItem>
        <DrawerItem sector="nodes">Memory</DrawerItem>
        <DrawerItem sector="dreams">Learning</DrawerItem>
        <DrawerItem sector="canvas">Canvas</DrawerItem>
        <DrawerItem sector="skills">Tools</DrawerItem>
        <DrawerItem sector="usage">Models</DrawerItem>
        <DrawerItem sector="config">Settings</DrawerItem>
      </nav>
      <div className="mobile-drawer__footer">
        <button className="mobile-drawer__action" type="button" id="mobile-drawer-search">
          Search
        </button>
        <span className="mobile-drawer__status">Ready</span>
      </div>
    </aside>
  );
}
