import { IconMenu, IconMoon, IconSearch, IconSun, IconZavorthMark } from "./ZavorthControlIcons";

export function ZavorthControlBridge() {
  return (
    <header className="bridge" id="bridge">
      <div className="bridge__left">
        <button className="bridge__menu-trigger" id="mobile-menu-trigger">
          <IconMenu />
        </button>
        <div className="bridge__brand">
          <div className="bridge__logo">
            <IconZavorthMark />
          </div>
          <div className="bridge__brand-text">
            <span className="bridge__brand-eyebrow">Zavorth Home</span>
            <span className="bridge__brand-name">Zavorth</span>
          </div>
        </div>
      </div>
      <div className="bridge__center">
        <span className="bridge__path" id="bridge-path">
          Zavorth
        </span>
        <span className="bridge__path-sep">&gt;</span>
        <span className="bridge__path-current" id="bridge-current">
          Inbox
        </span>
      </div>
      <div className="bridge__right">
        <div className="bridge__telemetry">
          <div className="bridge__pulse" id="core-pulse">
            <span className="bridge__pulse-dot" />
            <span className="bridge__pulse-label">Ready</span>
          </div>
        </div>
        <button className="bridge__action-btn" id="theme-toggle" aria-label="Toggle theme">
          <IconSun />
          <IconMoon />
        </button>
        <div className="bridge__search" id="search-trigger">
          <IconSearch />
          <span className="bridge__search-label">Search...</span>
          <kbd className="bridge__search-kbd">Ctrl K</kbd>
          <button className="bridge__search-ghost" id="search-btn" />
        </div>
      </div>
    </header>
  );
}
