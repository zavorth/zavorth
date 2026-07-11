import React from 'react';
import { render } from '@testing-library/react';
import {
  StatusBadge,
  RiskBadge,
  SurfaceCard,
  EmptyState,
  InlineAlert,
  SectionHeader,
  ActionHint,
} from '../../../apps/zavorth-desktop/src/components/ProductPolishComponents';

describe('ProductSurfacePolish UX Tests', () => {
  it('renders StatusBadge with different statuses without crashing', () => {
    const { container: success } = render(<StatusBadge status="success">Pronto</StatusBadge>);
    expect(success.textContent).toContain('Pronto');

    const { container: warning } = render(<StatusBadge status="warning">Atenção</StatusBadge>);
    expect(warning.textContent).toContain('Atenção');
  });

  it('renders RiskBadge with correct labels', () => {
    const { container: low } = render(<RiskBadge level="LOW" />);
    expect(low.textContent).toContain('Risco Baixo');

    const { container: critical } = render(<RiskBadge level="CRITICAL" />);
    expect(critical.textContent).toContain('Risco Crítico');
  });

  it('renders SurfaceCard with title and children', () => {
    const { container } = render(
      <SurfaceCard title="Test Card">
        <p>Content</p>
      </SurfaceCard>
    );
    expect(container.textContent).toContain('Test Card');
    expect(container.textContent).toContain('Content');
  });

  it('renders EmptyState with title and description', () => {
    const { container } = render(
      <EmptyState title="Nenhuma tarefa encontrada" description="Inicie uma tarefa para ver resultados" />
    );
    expect(container.textContent).toContain('Nenhuma tarefa encontrada');
    expect(container.textContent).toContain('Inicie uma tarefa para ver resultados');
  });

  it('renders InlineAlert with correct messages', () => {
    const { container } = render(
      <InlineAlert type="warning" title="Aviso Importante" message="Esta ação consome uma aprovação." />
    );
    expect(container.textContent).toContain('Aviso Importante');
    expect(container.textContent).toContain('Esta ação consome uma aprovação.');
  });

  it('renders SectionHeader and ActionHint', () => {
    const { container: header } = render(
      <SectionHeader title="Políticas de Postura" description="Configurações globais de segurança" />
    );
    expect(header.textContent).toContain('Políticas de Postura');
    expect(header.textContent).toContain('Configurações globais de segurança');

    const { container: hint } = render(<ActionHint message="Clique em recalcular para atualizar." />);
    expect(hint.textContent).toContain('Clique em recalcular para atualizar.');
  });
});
