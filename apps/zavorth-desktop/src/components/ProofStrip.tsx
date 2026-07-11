/**
 * Compact horizontal proof strip for chat home.
 * Shows last 1–3 receipts + CTA to open the full proof (receipts) panel.
 *
 * Navigation: primary CTA uses `onOpenProof` → receipts panel.
 * Product note: open proof via sidebar Proof / Command Center; document
 * preferred keys **R** / `g p` in DESIGN.md (no global shortcut binding yet).
 */

import { Button } from '../primitives';
import { t } from '../i18n';
import type { DesktopReceipt } from '../desktop-state/receiptsLedger';
import {
  selectProofStripItems,
  type ProofStripItem,
} from '../desktop-state/proofStripModel';
import {
  formatRiskBudgetStatusLine,
  type DesktopRiskBudgetState,
} from '../desktop-state/riskBudgetBridge';

export type ProofStripProps = {
  receipts: DesktopReceipt[];
  onOpenProof(): void;
  onOpenReceipt?: (receipt: DesktopReceipt) => void;
  /** Optional risk budget state (pure props — no filesystem). */
  riskBudgetState?: DesktopRiskBudgetState | null;
  language?: string | null;
  className?: string;
};

export function ProofStrip(props: ProofStripProps) {
  const items = selectProofStripItems(props.receipts, 3);
  const lang = props.language;
  const riskLine = props.riskBudgetState !== undefined
    ? formatRiskBudgetStatusLine(props.riskBudgetState)
    : null;

  return (
    <section
      className={['zvd-proof-strip', props.className].filter(Boolean).join(' ')}
      aria-label={t('proof.stripTitle', lang)}
      data-proof-strip
    >
      <div className="zvd-proof-strip__main">
        <span className="zvd-proof-strip__eyebrow">{t('proof.stripTitle', lang)}</span>
        {items.length === 0 ? (
          <p className="zvd-proof-strip__empty">{t('proof.stripEmpty', lang)}</p>
        ) : (
          <ul className="zvd-proof-strip__list">
            {items.map((item) => (
              <ProofStripRow
                key={item.id}
                item={item}
                onOpen={
                  props.onOpenReceipt
                    ? () => {
                        const full = props.receipts.find((r) => r.id === item.id);
                        if (full) props.onOpenReceipt?.(full);
                        else props.onOpenProof();
                      }
                    : props.onOpenProof
                }
              />
            ))}
          </ul>
        )}
      </div>

      <div className="zvd-proof-strip__actions">
        {riskLine ? (
          <span
            className="zvd-risk-budget-chip"
            title={riskLine}
            data-risk-budget-chip
          >
            <span className="zvd-risk-budget-chip__label">{t('riskBudget.chipLabel', lang)}</span>
            <span className="zvd-risk-budget-chip__value">{riskLine}</span>
          </span>
        ) : null}
        <Button variant="ghost" size="sm" onClick={props.onOpenProof}>
          {t('proof.stripOpen', lang)}
        </Button>
      </div>
    </section>
  );
}

function ProofStripRow(props: {
  item: ProofStripItem;
  onOpen(): void;
}) {
  return (
    <li>
      <button
        type="button"
        className={`zvd-proof-strip__item zvd-proof-strip__item--${props.item.tone}`}
        onClick={props.onOpen}
        data-proof-tone={props.item.tone}
        title={props.item.title}
      >
        <span className="zvd-proof-strip__dot" aria-hidden="true" />
        <span className="zvd-proof-strip__item-title">{props.item.title}</span>
      </button>
    </li>
  );
}
