/** @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  EmptyState,
  InlineAlert,
  LemniscateStateLoader,
  RecoveryOverlay,
  StatusBadge,
} from '../../../apps/zavorth-desktop/src/components/ProductPolishComponents';

describe('Desktop P2 state surfaces', () => {
  it('renders empty states as a premium state card with an action', () => {
    const onAction = jest.fn();

    render(
      <EmptyState
        title="Nenhum provider ativo"
        description="Conecte um provider para liberar o agente local."
        actionLabel="Conectar provider"
        onAction={onAction}
      />,
    );

    expect(screen.getByText('Nenhum provider ativo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Conectar provider' })).toHaveClass('zvd-state-action');
    expect(screen.getByText('Nenhum provider ativo').closest('.zvd-premium-empty-state')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Conectar provider' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('supports neutral status and non-emoji inline alerts', () => {
    const { container } = render(
      <>
        <StatusBadge status="neutral">Carregando</StatusBadge>
        <InlineAlert type="warning" title="Workspace sem confiança" message="Revise antes de permitir escrita." />
      </>,
    );

    expect(screen.getByText('Carregando')).toHaveClass('zvd-status-badge--neutral');
    expect(container.querySelector('.zvd-premium-alert')).toBeInTheDocument();
    expect(container.textContent).not.toContain('undefined');
    expect(container.textContent).not.toContain('null');
  });

  it('offers a recovery overlay with retry and settings actions', () => {
    const onRetry = jest.fn();
    const onSettings = jest.fn();

    render(
      <RecoveryOverlay
        title="Runtime indisponivel"
        message="O runtime local parou de responder."
        retryLabel="Tentar novamente"
        settingsLabel="Abrir diagnosticos"
        onRetry={onRetry}
        onSettings={onSettings}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abrir diagnosticos' }));

    expect(screen.getByRole('dialog')).toHaveClass('zvd-recovery-overlay');
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onSettings).toHaveBeenCalledTimes(1);
  });

  it('uses the shared loader surface for compact and centered loading states', () => {
    const { container } = render(<LemniscateStateLoader text="Sincronizando" compact />);
    expect(container.querySelector('.zvd-state-loader')).toBeInTheDocument();
    expect(screen.getByText('Sincronizando')).toBeInTheDocument();
  });
});
