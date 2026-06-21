import React from 'react';
import { render } from '@testing-library/react';
import {
  EmptyState,
  InlineAlert,
  StatusBadge,
} from '../../../apps/zavorth-desktop/src/components/ProductPolishComponents';

describe('ProductEmptyStates UX Tests (Phase 21N)', () => {
  it('renders EmptyState for missing workspace scenario', () => {
    const { container } = render(
      <EmptyState
        title="Nenhum workspace configurado"
        description="Abra ou crie um workspace para começar a usar o Zavorth."
      />
    );
    expect(container.textContent).toContain('Nenhum workspace configurado');
    expect(container.textContent).toContain('Abra ou crie um workspace');
    expect(container.textContent).not.toContain('undefined');
    expect(container.textContent).not.toContain('null');
    expect(container.textContent).not.toContain('[object Object]');
  });

  it('renders EmptyState for missing provider scenario', () => {
    const { container } = render(
      <EmptyState
        title="Nenhum provider ativo"
        description="Configure um provider de IA em Configurações > Providers para habilitar o agente."
      />
    );
    expect(container.textContent).toContain('Nenhum provider ativo');
    expect(container.textContent).toContain('Configure um provider');
  });

  it('renders EmptyState for empty task list', () => {
    const { container } = render(
      <EmptyState
        title="Nenhuma tarefa em andamento"
        description="Inicie uma conversa com o Zavorth para ver suas tarefas aqui."
      />
    );
    expect(container.textContent).toContain('Nenhuma tarefa em andamento');
  });

  it('renders EmptyState for empty memory list', () => {
    const { container } = render(
      <EmptyState
        title="Nenhuma memória salva"
        description="O Zavorth irá aprender com suas interações e salvar referências úteis aqui."
      />
    );
    expect(container.textContent).toContain('Nenhuma memória salva');
  });

  it('renders error InlineAlert for workspace_not_trusted state', () => {
    const { container } = render(
      <InlineAlert
        type="warning"
        title="Workspace não confiado"
        message="Para continuar, confirme que este workspace é seguro e confiável."
      />
    );
    expect(container.textContent).toContain('Workspace não confiado');
    expect(container.textContent).toContain('confirme que este workspace');
  });

  it('renders error InlineAlert for missing API key state', () => {
    const { container } = render(
      <InlineAlert
        type="error"
        title="Chave de API ausente"
        message="O provider selecionado não possui uma chave de API configurada. Acesse Configurações > Providers."
      />
    );
    expect(container.textContent).toContain('Chave de API ausente');
    expect(container.textContent).not.toContain('undefined');
  });

  it('renders StatusBadge for loading state without null values', () => {
    const { container } = render(
      <StatusBadge status="neutral">Carregando…</StatusBadge>
    );
    expect(container.textContent).toContain('Carregando');
    expect(container.textContent).not.toContain('null');
    expect(container.textContent).not.toContain('undefined');
  });

  it('renders StatusBadge for success state', () => {
    const { container } = render(
      <StatusBadge status="success">Pronto</StatusBadge>
    );
    expect(container.textContent).toContain('Pronto');
  });

  it('renders StatusBadge for error state', () => {
    const { container } = render(
      <StatusBadge status="error">Falha</StatusBadge>
    );
    expect(container.textContent).toContain('Falha');
  });
});
