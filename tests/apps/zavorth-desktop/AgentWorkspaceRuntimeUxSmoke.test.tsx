/**
 * Agent Workspace Runtime UX Smoke Tests
 *
 * Validates UI component states:
 *   - loading / ready / not-ready states render correctly
 *   - no secrets in rendered output
 *   - missing provider / missing model / missing API key messaging
 *   - capability state display
 *   - security flags display correctly
 *
 * Security marker: sk-zavorth-e2e-runtime-smoke-DO-NOT-LEAK-21K-A
 * Must NEVER appear in rendered output.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { WorkspaceRuntimeReadinessCard, WorkspaceRuntimeReadiness } from '../../../apps/zavorth-desktop/src/components/WorkspaceRuntimeReadinessCard';
import { WorkspacePolicyPreview, WorkspacePolicyPreviewData } from '../../../apps/zavorth-desktop/src/components/WorkspacePolicyPreview';

const SMOKE_MARKER = 'sk-zavorth-e2e-runtime-smoke-DO-NOT-LEAK-21K-A';

// ─── WorkspaceRuntimeReadinessCard ─────────────────────────────────────────

describe('WorkspaceRuntimeReadinessCard UX Smoke', () => {
  it('renders loading state when readiness is null', () => {
    const { container } = render(<WorkspaceRuntimeReadinessCard readiness={null} />);
    expect(container.textContent).toContain('Carregando');
    expect(container.querySelector('.loading')).not.toBeNull();
  });

  it('renders ready state correctly', () => {
    const readiness: WorkspaceRuntimeReadiness = {
      workspaceId: 'ws-test',
      ready: true,
      providerReady: true,
      modelReady: true,
      autonomyReady: true,
      policyReady: true,
      issues: [],
    };
    const { container } = render(<WorkspaceRuntimeReadinessCard readiness={readiness} />);
    expect(container.textContent).toContain('Ready');
    expect(container.querySelector('.ready')).not.toBeNull();
    expect(container.querySelector('.not-ready')).toBeNull();
  });

  it('renders not-ready state when provider is missing', () => {
    const readiness: WorkspaceRuntimeReadiness = {
      workspaceId: 'ws-test',
      ready: false,
      providerReady: false,
      modelReady: false,
      autonomyReady: true,
      policyReady: true,
      issues: [{ code: 'no_provider', severity: 'error', message: 'No provider configured.' }],
    };
    const { container } = render(<WorkspaceRuntimeReadinessCard readiness={readiness} />);
    expect(container.textContent).toContain('Not Ready');
    expect(container.querySelector('.not-ready')).not.toBeNull();
    expect(container.textContent).toContain('No provider configured');
  });

  it('renders missing model warning', () => {
    const readiness: WorkspaceRuntimeReadiness = {
      workspaceId: 'ws-test',
      ready: false,
      providerReady: true,
      modelReady: false,
      autonomyReady: true,
      policyReady: true,
      issues: [{ code: 'no_model', severity: 'warning', message: 'No default model configured.' }],
    };
    const { container } = render(<WorkspaceRuntimeReadinessCard readiness={readiness} />);
    expect(container.textContent).toContain('no_model');
    expect(container.textContent).toContain('No default model configured');
  });

  it('redacts API key pattern if it slips through to readiness message', () => {
    const readiness: WorkspaceRuntimeReadiness = {
      workspaceId: 'ws-test',
      ready: false,
      providerReady: false,
      modelReady: false,
      autonomyReady: true,
      policyReady: true,
      issues: [{
        code: 'provider_error',
        severity: 'error',
        // Simulate a secret accidentally appearing in a message
        message: `Provider error: key=${SMOKE_MARKER}`,
      }],
    };
    const { container } = render(<WorkspaceRuntimeReadinessCard readiness={readiness} />);
    // Component's own redaction regex should have stripped the sk-... pattern
    expect(container.textContent).not.toContain(SMOKE_MARKER);
    expect(container.textContent).toContain('[REDACTED_SECRET]');
  });

  it('renders readiness flags Provider / Model / Autonomy / Policy', () => {
    const readiness: WorkspaceRuntimeReadiness = {
      workspaceId: 'ws-test',
      ready: false,
      providerReady: false,
      modelReady: false,
      autonomyReady: true,
      policyReady: true,
      issues: [],
    };
    const { container } = render(<WorkspaceRuntimeReadinessCard readiness={readiness} />);
    expect(container.textContent).toContain('Provider');
    expect(container.textContent).toContain('Model');
    expect(container.textContent).toContain('Autonomy');
    expect(container.textContent).toContain('Policy');
  });

  it('never renders smoke marker in any state', () => {
    const readiness: WorkspaceRuntimeReadiness = {
      workspaceId: 'ws-test',
      ready: true,
      providerReady: true,
      modelReady: true,
      autonomyReady: true,
      policyReady: true,
      issues: [],
    };
    const { container } = render(<WorkspaceRuntimeReadinessCard readiness={readiness} />);
    expect(container.textContent).not.toContain(SMOKE_MARKER);
    expect(container.textContent).not.toContain('sk-');
    expect(container.textContent).not.toContain('Authorization');
    expect(container.textContent).not.toContain('Bearer');
    expect(container.textContent).not.toContain('secretRef');
  });
});

// ─── WorkspacePolicyPreview ─────────────────────────────────────────────────

describe('WorkspacePolicyPreview UX Smoke', () => {
  const safePreview: WorkspacePolicyPreviewData = {
    providerId: 'ws-openai',
    modelId: 'gpt-4',
    allowedCapabilities: ['chat'],
    autonomyProfile: 'safe',
    allowDeveloperMode: false,
    allowHostPowerMode: false,
    allowPty: false,
    allowTaskMandates: true,
    allowTemporaryDirectoryTrust: false,
    allowProviderFallback: false,
    riskLevel: 'LOW',
    warnings: [],
  };

  it('renders loading state when preview is null', () => {
    const { container } = render(<WorkspacePolicyPreview preview={null} />);
    expect(container.querySelector('.loading')).not.toBeNull();
    expect(container.textContent).toContain('Carregando');
  });

  it('renders risk level LOW for safe config', () => {
    const { container } = render(<WorkspacePolicyPreview preview={safePreview} />);
    expect(container.textContent).toContain('LOW');
    expect(container.querySelector('.risk-low')).not.toBeNull();
  });

  it('shows Developer Mode: Blocked when allowDeveloperMode=false', () => {
    const { container } = render(<WorkspacePolicyPreview preview={safePreview} />);
    expect(container.textContent).toContain('Developer Mode: Blocked');
  });

  it('shows Host Power Mode: Blocked when allowHostPowerMode=false', () => {
    const { container } = render(<WorkspacePolicyPreview preview={safePreview} />);
    expect(container.textContent).toContain('Host Power Mode: Blocked');
  });

  it('shows PTY: Blocked when allowPty=false', () => {
    const { container } = render(<WorkspacePolicyPreview preview={safePreview} />);
    expect(container.textContent).toContain('PTY: Blocked');
  });

  it('shows Provider Fallback: Blocked when allowProviderFallback=false', () => {
    const { container } = render(<WorkspacePolicyPreview preview={safePreview} />);
    expect(container.textContent).toContain('Provider Fallback: Blocked');
  });

  it('shows Temporary Directory Trust: Blocked when allowTemporaryDirectoryTrust=false', () => {
    const { container } = render(<WorkspacePolicyPreview preview={safePreview} />);
    expect(container.textContent).toContain('Temporary Directory Trust: Blocked');
  });

  it('shows correct states when capabilities are unlocked', () => {
    const unlockedPreview: WorkspacePolicyPreviewData = {
      ...safePreview,
      allowDeveloperMode: true,
      allowHostPowerMode: true,
      allowPty: true,
      allowProviderFallback: true,
      riskLevel: 'HIGH',
    };
    const { container } = render(<WorkspacePolicyPreview preview={unlockedPreview} />);
    expect(container.textContent).toContain('Developer Mode: Allowed');
    expect(container.textContent).toContain('Host Power Mode: Allowed');
    expect(container.textContent).toContain('PTY: Allowed');
    expect(container.textContent).toContain('Provider Fallback: Allowed');
    expect(container.textContent).toContain('HIGH');
  });

  it('redacts sensitive token if accidentally present in warning message', () => {
    const preview: WorkspacePolicyPreviewData = {
      ...safePreview,
      warnings: [{ code: 'test', severity: 'warning', message: `Bearer ${SMOKE_MARKER} found` }],
    };
    const { container } = render(<WorkspacePolicyPreview preview={preview} />);
    // The smoke marker must not appear — component strips sk-... pattern first,
    // producing [REDACTED_SECRET]; the full token is sanitized regardless of order.
    expect(container.textContent).not.toContain(SMOKE_MARKER);
    expect(container.textContent).not.toContain('sk-');
  });

  it('never shows provider ID as a secret', () => {
    const { container } = render(<WorkspacePolicyPreview preview={safePreview} />);
    // providerId is shown but must not be a secret value
    expect(container.textContent).toContain('ws-openai');
    expect(container.textContent).not.toContain('sk-');
    expect(container.textContent).not.toContain('secretRef');
    expect(container.textContent).not.toContain(SMOKE_MARKER);
  });

  it('never renders smoke marker in any state', () => {
    const { container } = render(<WorkspacePolicyPreview preview={safePreview} />);
    expect(container.textContent).not.toContain(SMOKE_MARKER);
    expect(container.textContent).not.toContain('Authorization');
    expect(container.textContent).not.toContain('Bearer sk-');
  });
});
