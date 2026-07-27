import React from 'react';
import { render } from '@testing-library/react';
import {
  EmptyState,
  InlineAlert,
  StatusBadge,
} from '../../../apps/zavorth-desktop/src/components/ProductPolishComponents';

describe('ProductEmptyStates UX Tests', () => {
  it('renders EmptyState for missing workspace scenario', () => {
    const { container } = render(
      <EmptyState
        title="No workspace configurado"
        description="Open or create a workspace to start using Zavorth."
      />
    );
    expect(container.textContent).toContain('No workspace configurado');
    expect(container.textContent).toContain('Abra ou crie um workspace');
    expect(container.textContent).not.toContain('undefined');
    expect(container.textContent).not.toContain('null');
    expect(container.textContent).not.toContain('[object Object]');
  });

  it('renders EmptyState for missing provider scenario', () => {
    const { container } = render(
      <EmptyState
        title="No provider active"
        description="Configure an AI provider in Settings > Providers to enable the agent."
      />
    );
    expect(container.textContent).toContain('No provider active');
    expect(container.textContent).toContain('Configure um provider');
  });

  it('renders EmptyState for empty task list', () => {
    const { container } = render(
      <EmptyState
        title="No task in progress"
        description="Start a conversation with Zavorth to see your tasks here."
      />
    );
    expect(container.textContent).toContain('No task in progress');
  });

  it('renders EmptyState for empty memory list', () => {
    const { container } = render(
      <EmptyState
        title="No saved memory"
        description="O Zavorth ira aprender com suas interactions e salvar referencias uteis aqui."
      />
    );
    expect(container.textContent).toContain('No saved memory');
  });

  it('renders error InlineAlert for workspace_not_trusted state', () => {
    const { container } = render(
      <InlineAlert
        type="warning"
        title="Untrusted workspace"
        message="To continue, confirm this workspace is safe and trusted."
      />
    );
    expect(container.textContent).toContain('Untrusted workspace');
    expect(container.textContent).toContain('confirme que este workspace');
  });

  it('renders error InlineAlert for missing API key state', () => {
    const { container } = render(
      <InlineAlert
        type="error"
        title="Chave de API missing"
        message="The selected provider has no configured API key. Open Settings > Providers."
      />
    );
    expect(container.textContent).toContain('Chave de API missing');
    expect(container.textContent).not.toContain('undefined');
  });

  it('renders StatusBadge for loading state without null values', () => {
    const { container } = render(
      <StatusBadge status="neutral">Loading...</StatusBadge>
    );
    expect(container.textContent).toContain('Carregando');
    expect(container.textContent).not.toContain('null');
    expect(container.textContent).not.toContain('undefined');
  });

  it('renders StatusBadge for success state', () => {
    const { container } = render(
      <StatusBadge status="success">Ready</StatusBadge>
    );
    expect(container.textContent).toContain('Ready');
  });

  it('renders StatusBadge for error state', () => {
    const { container } = render(
      <StatusBadge status="error">Failure</StatusBadge>
    );
    expect(container.textContent).toContain('Failure');
  });
});
