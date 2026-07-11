import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  LIVE_MULTI_STEP_TOKEN,
  LIVE_PROBE_TOKEN,
  LiveUserProviderHarness,
  resolveLiveCredentials,
} from '../../../src/services/agent-smartness/LiveUserProviderHarness.js';
import { AgentSmartnessLiveService } from '../../../src/services/agent-smartness/AgentSmartnessLiveService.js';
import { resolveAutopilotCapabilityId } from '../../../src/services/CapabilityAutopilotSelection.js';
import { TimeToFirstUsefulWorkService, TTFU_BUDGET_MS } from '../../../src/services/agent-smartness/TimeToFirstUsefulWorkService.js';
import { CORE_PROVIDER_INTEGRATION_MANIFESTS } from '../../../src/services/providers/catalog/manifests/coreProviders.js';
import { LOCAL_AND_CUSTOM_PROVIDER_INTEGRATION_MANIFESTS } from '../../../src/services/providers/catalog/manifests/localAndCustomProviders.js';

describe('V8 LiveUserProviderHarness', () => {
  it('does not invent gemini when multiple keys exist without selection', () => {
    const creds = resolveLiveCredentials({
      projectRoot: process.cwd(),
      env: {
        OPENAI_API_KEY: 'sk-test-openai-key-123456',
        ANTHROPIC_API_KEY: 'sk-ant-test-key-123456',
      } as NodeJS.ProcessEnv,
    });
    expect(creds.family).toBeNull();
    expect(creds.apiKey).toBe('');
    expect(creds.credentialSource).toBe('none');
    expect(creds.reason).toMatch(/Multiple provider keys/i);
  });

  it('uses user-selected openai when key is present', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sel-'));
    fs.mkdirSync(path.join(dir, 'data', 'runtime'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'data', 'runtime', 'provider-selection-preferences.json'),
      JSON.stringify({ providerId: 'openai', modelId: 'gpt-4o-mini' }),
    );
    const creds = resolveLiveCredentials({
      projectRoot: dir,
      env: {
        OPENAI_API_KEY: 'sk-test-openai-key-123456',
        GEMINI_API_KEY: 'gemini-should-not-win-123456',
      } as NodeJS.ProcessEnv,
    });
    expect(creds.family).toBe('openai');
    expect(creds.credentialSource).toBe('selection');
    expect(creds.apiKey.startsWith('sk-test')).toBe(true);
  });

  it('honors an injected provider selection even when ambient env disagrees', () => {
    const previous = process.env.LLM_PROVIDER;
    process.env.LLM_PROVIDER = 'gemini';
    try {
      const creds = resolveLiveCredentials({
        projectRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-sel-')),
        env: {
          LLM_PROVIDER: 'anthropic',
          ANTHROPIC_API_KEY: 'sk-ant-test-key-123456',
          GEMINI_API_KEY: 'gemini-ambient-must-not-win',
        } as NodeJS.ProcessEnv,
      });
      expect(creds.family).toBe('anthropic');
      expect(creds.providerId).toBe('anthropic');
      expect(creds.credentialSource).toBe('selection');
    } finally {
      if (previous === undefined) delete process.env.LLM_PROVIDER;
      else process.env.LLM_PROVIDER = previous;
    }
  });

  it('runs real multi-step tool rounds via transport (openai mock)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ms-'));
    let calls = 0;
    const harness = new LiveUserProviderHarness({
      projectRoot: dir,
      env: {
        LLM_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test-openai-key-123456',
        ZAVORTH_MODEL_ID: 'gpt-4o-mini',
      } as NodeJS.ProcessEnv,
      transport: async () => {
        calls += 1;
        if (calls === 1) {
          return {
            status: 200,
            body: JSON.stringify({
              choices: [{
                message: {
                  role: 'assistant',
                  tool_calls: [{
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'zavorth_live_marker', arguments: '{}' },
                  }],
                },
              }],
            }),
          };
        }
        const markerPath = path.join(dir, 'data', 'runtime', 'live-multi-step-marker.txt');
        const marker = fs.readFileSync(markerPath, 'utf8').trim();
        return {
          status: 200,
          body: JSON.stringify({
            choices: [{
              message: { role: 'assistant', content: `${LIVE_MULTI_STEP_TOKEN} ${marker}` },
            }],
          }),
        };
      },
    });

    const probe = await harness.runProbe();
    // probe uses same transport; first call is consumed — reconfigure sequential transport carefully
    expect(['pass', 'fail', 'blocked']).toContain(probe.status);

    calls = 0;
    const multi = await harness.runMultiStepToolPlan();
    expect(multi.status).toBe('pass');
    expect(multi.evidence.autoCertified).toBe(true);
    expect(String(multi.evidence.toolName)).toBe('zavorth_live_marker');
    expect(calls).toBe(2);
  });

  it('routes a custom selected provider through the production runtime contract', async () => {
    let calls = 0;
    const harness = new LiveUserProviderHarness({
      projectRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-custom-runtime-')),
      env: {
        LLM_PROVIDER: 'company-compatible',
        ZAVORTH_MODEL_ID: 'company-model',
      } as NodeJS.ProcessEnv,
      runtimeFactory: () => ({
        chatDetailed: async (messages: Array<{ role?: string; content?: string }> = [], tools: unknown[] = []) => {
          calls += 1;
          const joined = messages.map((entry) => String(entry?.content || '')).join('\n');
          const markerMatch = joined.match(/MS-[a-f0-9]+/i);
          const marker = markerMatch?.[0] || 'MS-test';
          const response = calls === 1
            ? { content: '', toolCalls: [{ id: 'custom-call-1', name: 'zavorth_live_marker', arguments: {} }], finishReason: 'tool_calls' }
            : { content: `${LIVE_MULTI_STEP_TOKEN} ${marker}`, toolCalls: [], finishReason: 'stop' };
          return {
            providerName: 'company-compatible',
            modelName: 'company-model',
            response,
            route: {
              source: 'LlmRuntimeService',
              requestedProviderName: 'company-compatible',
              primaryProviderName: 'company-compatible',
              providerName: 'company-compatible',
              modelName: 'company-model',
              fallbackAllowed: false,
              fallbackUsed: false,
              providerChain: ['company-compatible'],
              attempts: [{ providerName: 'company-compatible', modelName: 'company-model', status: 'succeeded', fallback: false, durationMs: 1 }],
              request: { messageCount: 1, toolCount: tools.length, inputChars: 1 },
            },
          } as any;
        },
      }),
    });

    const result = await harness.runMultiStepToolPlan();
    expect(result.status).toBe('pass');
    expect(result.evidence.runtimePath).toBe(true);
    expect(result.evidence.providerId).toBe('company-compatible');
    expect(result.evidence.fallbackUsed).toBe(false);
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it('marks claimsLiveIntelligence only when multi-step passes', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-live-svc-'));
    let calls = 0;
    const harness = new LiveUserProviderHarness({
      projectRoot: dir,
      env: {
        LLM_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test-openai-key-123456',
      } as NodeJS.ProcessEnv,
      transport: async (req) => {
        calls += 1;
        const body = String(req.body || '');
        if (body.includes(LIVE_PROBE_TOKEN) && !body.includes('zavorth_live_marker')) {
          return {
            status: 200,
            body: JSON.stringify({
              choices: [{ message: { content: LIVE_PROBE_TOKEN } }],
            }),
          };
        }
        if (body.includes('"tools"') || body.includes('tool_choice')) {
          return {
            status: 200,
            body: JSON.stringify({
              choices: [{
                message: {
                  role: 'assistant',
                  tool_calls: [{
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'zavorth_live_marker', arguments: '{}' },
                  }],
                },
              }],
            }),
          };
        }
        const markerPath = path.join(dir, 'data', 'runtime', 'live-multi-step-marker.txt');
        const marker = fs.existsSync(markerPath) ? fs.readFileSync(markerPath, 'utf8').trim() : '';
        return {
          status: 200,
          body: JSON.stringify({
            choices: [{ message: { content: `${LIVE_MULTI_STEP_TOKEN} ${marker}` } }],
          }),
        };
      },
    });

    const report = await new AgentSmartnessLiveService({
      projectRoot: dir,
      env: {
        LLM_PROVIDER: 'openai',
        OPENAI_API_KEY: 'sk-test-openai-key-123456',
      } as NodeJS.ProcessEnv,
      harness,
    }).run({ live: true });

    expect(report.liveOk).toBe(true);
    expect(report.multiStepOk).toBe(true);
    expect(report.claimsLiveIntelligence).toBe(true);
    expect(report.live.find((e) => e.id === 'live.multi-step.tool-plan')?.status).toBe('pass');
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('does not certify live intelligence from a completion probe alone', async () => {
    const harness = {
      runProbe: async () => ({ status: 'pass', notes: 'probe passed', evidence: {} }),
      runMultiStepToolPlan: async () => ({ status: 'blocked', notes: 'tool round unavailable', evidence: {} }),
    } as unknown as LiveUserProviderHarness;
    const report = await new AgentSmartnessLiveService({
      projectRoot: process.cwd(),
      env: { LLM_PROVIDER: 'openai' } as NodeJS.ProcessEnv,
      harness,
    }).run({ live: true });

    expect(report.liveOk).toBe(false);
    expect(report.multiStepOk).toBe(false);
    expect(report.claimsLiveIntelligence).toBe(false);
    expect(report.blockedOnly).toBe(true);
  });
});

describe('V8 TTFU', () => {
  it('passes structural check and records under-budget measurement', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-ttfu-'));
    const service = new TimeToFirstUsefulWorkService({
      projectRoot: process.cwd(),
      now: () => new Date('2026-07-11T12:00:00.000Z'),
    });
    const structural = service.structuralCheck();
    expect(structural.ok).toBe(true);
    expect(structural.budgetMs).toBe(TTFU_BUDGET_MS);

    const isolated = new TimeToFirstUsefulWorkService({
      projectRoot: dir,
      codeRoot: process.cwd(),
    });
    const measurement = isolated.record({
      startedAt: '2026-07-11T12:00:00.000Z',
      firstUsefulAt: '2026-07-11T12:01:30.000Z',
      surface: 'desktop',
      providerId: 'openai',
      providerAlreadyConfigured: true,
    });
    expect(measurement.durationMs).toBe(90_000);
    expect(measurement.underBudget).toBe(true);
    const report = isolated.run();
    expect(report.structural.ok).toBe(true);
    expect(report.claimsMeasuredUnder3Min).toBe(true);
    expect(report.ok).toBe(true);
  });
});

describe('V10 neutral defaults', () => {
  it('fails closed without autopilot capability', () => {
    const resolved = resolveAutopilotCapabilityId([], {});
    expect(resolved.capabilityId).toBeNull();
    expect(resolved.source).toBe('none');
    expect(resolved.error).toMatch(/No capability selected/i);
  });

  it('accepts explicit capability arg or env', () => {
    expect(resolveAutopilotCapabilityId(['--capability=executor-external-executor'], {}).capabilityId)
      .toBe('executor-external-executor');
    expect(
      resolveAutopilotCapabilityId([], { ZAVORTH_AUTOPILOT_CAPABILITY: 'openai' } as NodeJS.ProcessEnv)
        .capabilityId,
    ).toBe('openai');
  });

  it('keeps product catalog fallbackRouteIds empty by default', () => {
    const manifests = [
      ...CORE_PROVIDER_INTEGRATION_MANIFESTS,
      ...LOCAL_AND_CUSTOM_PROVIDER_INTEGRATION_MANIFESTS,
    ];
    for (const manifest of manifests) {
      for (const route of manifest.routes || []) {
        const fallbacks = route.fallbackRouteIds || [];
        expect(fallbacks).toEqual([]);
      }
    }
  });
});
