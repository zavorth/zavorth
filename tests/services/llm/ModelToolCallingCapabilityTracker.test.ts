import { ModelToolCallingCapabilityTracker } from '../../../src/services/llm/ModelToolCallingCapabilityTracker.js';

describe('ModelToolCallingCapabilityTracker', () => {
  beforeEach(() => {
    ModelToolCallingCapabilityTracker.resetForTests();
    delete process.env.ZAVORTH_TOOL_CALLING_MODE;
    delete process.env.ZAVORTH_CAPABILITY_STATE_FILE;
  });

  afterEach(() => {
    ModelToolCallingCapabilityTracker.resetForTests();
  });

  it('classifies a model as native after observing native tool_calls', () => {
    const tracker = ModelToolCallingCapabilityTracker.getInstance({ stateFilePath: null });
    tracker.record({ providerName: 'openai', modelName: 'gpt-test', hadNativeToolCalls: true, hadEmulatedToolCalls: false });
    expect(tracker.getTrack('openai', 'gpt-test')).toBe('native');
    expect(tracker.shouldInjectEmulationPrompt('openai', 'gpt-test')).toBe(false);
  });

  it('classifies a model as emulated after observing emulated invocations', () => {
    const tracker = ModelToolCallingCapabilityTracker.getInstance({ stateFilePath: null });
    tracker.record({ providerName: 'custom', modelName: 'tiny-model', hadNativeToolCalls: false, hadEmulatedToolCalls: true });
    expect(tracker.getTrack('custom', 'tiny-model')).toBe('emulated');
    expect(tracker.shouldInjectEmulationPrompt('custom', 'tiny-model')).toBe(true);
  });

  it('returns unknown before any observation or after plain-only responses', () => {
    const tracker = ModelToolCallingCapabilityTracker.getInstance({ stateFilePath: null });
    expect(tracker.getTrack('openai', 'gpt-test')).toBe('unknown');
    tracker.record({ providerName: 'openai', modelName: 'gpt-test', hadNativeToolCalls: false, hadEmulatedToolCalls: false });
    expect(tracker.getTrack('openai', 'gpt-test')).toBe('unknown');
  });

  it('tracks models independently per provider and model', () => {
    const tracker = ModelToolCallingCapabilityTracker.getInstance({ stateFilePath: null });
    tracker.record({ providerName: 'provider-a', modelName: 'm1', hadNativeToolCalls: true, hadEmulatedToolCalls: false });
    tracker.record({ providerName: 'provider-b', modelName: 'm2', hadNativeToolCalls: false, hadEmulatedToolCalls: true });
    expect(tracker.getTrack('provider-a', 'm1')).toBe('native');
    expect(tracker.getTrack('provider-b', 'm2')).toBe('emulated');
  });

  it('resolves mixed evidence toward the dominant signal', () => {
    const tracker = ModelToolCallingCapabilityTracker.getInstance({ stateFilePath: null });
    tracker.record({ providerName: 'p', modelName: 'm', hadNativeToolCalls: true, hadEmulatedToolCalls: false });
    tracker.record({ providerName: 'p', modelName: 'm', hadNativeToolCalls: false, hadEmulatedToolCalls: true });
    expect(tracker.getTrack('p', 'm')).toBe('native');
  });

  it('honors a forced mode from the environment', () => {
    process.env.ZAVORTH_TOOL_CALLING_MODE = 'emulated';
    const tracker = ModelToolCallingCapabilityTracker.getInstance({ stateFilePath: null });
    tracker.record({ providerName: 'openai', modelName: 'gpt-test', hadNativeToolCalls: true, hadEmulatedToolCalls: false });
    expect(tracker.getTrack('openai', 'gpt-test')).toBe('emulated');
  });
});
