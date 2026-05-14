"use client";

import { useMemo, useState } from "react";
import type {
  DashboardCommandAction,
  DashboardNavigationSector,
} from "../contracts";

type CommandCenterCommandPaletteProps = {
  open: boolean;
  actions: DashboardCommandAction[];
  sectors: DashboardNavigationSector[];
  activeSectorId: DashboardNavigationSector["id"];
  onClose: () => void;
  onAction: (action: DashboardCommandAction) => void;
  onNavigate: (sectorId: DashboardNavigationSector["id"]) => void;
};

export function CommandCenterCommandPalette({
  open,
  actions,
  sectors,
  activeSectorId,
  onClose,
  onAction,
  onNavigate,
}: CommandCenterCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleActions = useMemo(
    () => actions.filter((action) => matchesQuery(
      `${action.label} ${action.description} ${action.group}`,
      normalizedQuery,
    )),
    [actions, normalizedQuery],
  );
  const visibleSectors = useMemo(
    () => sectors.filter((sector) => sector.enabled && matchesQuery(
      `${sector.label} ${sector.title} ${sector.id}`,
      normalizedQuery,
    )),
    [sectors, normalizedQuery],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="bcc-command-palette-layer" role="dialog" aria-modal="true" aria-label="Command palette">
      <button
        type="button"
        className="bcc-command-palette__backdrop"
        aria-label="Fechar command palette"
        onClick={onClose}
      />
      <section className="bcc-command-palette">
        <div className="bcc-command-palette__header">
          <div>
            <p className="bcc-card__label">Command palette</p>
            <h2 className="bcc-card__title">O que voce quer abrir?</h2>
          </div>
          <button type="button" className="bcc-command-palette__close" onClick={onClose}>
            Esc
          </button>
        </div>
        <input
          className="bcc-command-palette__search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar acao, tela ou diagnostico"
          autoFocus
        />
        <div className="bcc-command-palette__section">
          <span className="bcc-command-palette__section-title">Acoes seguras</span>
          {visibleActions.length > 0 ? visibleActions.map((action) => (
            <button
              key={action.id}
              type="button"
              className="bcc-command-palette__item"
              data-danger={action.danger || undefined}
              onClick={() => {
                onAction(action);
                onClose();
              }}
            >
              <span>{action.label}</span>
              <small>{action.description}</small>
            </button>
          )) : (
            <p className="bcc-empty-note">Nenhuma acao encontrada.</p>
          )}
        </div>
        <div className="bcc-command-palette__section">
          <span className="bcc-command-palette__section-title">Telas</span>
          {visibleSectors.map((sector) => (
            <button
              key={sector.id}
              type="button"
              className="bcc-command-palette__item"
              data-active={sector.id === activeSectorId}
              onClick={() => {
                onNavigate(sector.id);
                onClose();
              }}
            >
              <span>{sector.label}</span>
              <small>{sector.title}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function matchesQuery(value: string, query: string): boolean {
  if (!query) {
    return true;
  }
  return value.toLowerCase().includes(query);
}
