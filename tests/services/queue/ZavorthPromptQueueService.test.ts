import { ZavorthPromptQueueService } from '../../../src/services/queue/ZavorthPromptQueueService';

describe('ZavorthPromptQueueService', () => {
  let service: ZavorthPromptQueueService;

  beforeEach(() => {
    service = new ZavorthPromptQueueService();
  });

  it('should enqueue and dequeue items respecting strict priority order', () => {
    service.enqueuePrompt({ content: 'Normal instruction', priority: 'ENQUEUED_PROMPT' });
    service.enqueuePrompt({ content: 'Urgent stop command', priority: 'CRITICAL_INTERRUPT' });
    service.enqueuePrompt({ content: 'Steer direction', priority: 'STEER_GUIDANCE' });

    const first = service.dequeueNext();
    expect(first?.priority).toBe('CRITICAL_INTERRUPT');
    expect(first?.content).toBe('Urgent stop command');

    const second = service.dequeueNext();
    expect(second?.priority).toBe('STEER_GUIDANCE');

    const third = service.dequeueNext();
    expect(third?.priority).toBe('ENQUEUED_PROMPT');

    expect(service.dequeueNext()).toBeNull();
  });

  it('should combine multiple queued steering items into structured execution context', () => {
    service.enqueuePrompt({ content: 'Focus only on authentication module', priority: 'STEER_GUIDANCE' });
    service.enqueuePrompt({ content: 'Emergency halt all writes', priority: 'CRITICAL_INTERRUPT' });

    const combined = service.combineQueuedSteering();

    expect(combined.hasCriticalInterrupt).toBe(true);
    expect(combined.totalQueuedItemsProcessed).toBe(2);
    expect(combined.primaryPrompt).toContain('[URGENT OPERATOR INTERRUPT]');
    expect(combined.primaryPrompt).toContain('[OPERATOR STEERING]');
    expect(service.getQueueLength()).toBe(0);
  });

  it('should return empty context when combining an empty queue', () => {
    const combined = service.combineQueuedSteering();
    expect(combined.totalQueuedItemsProcessed).toBe(0);
    expect(combined.hasCriticalInterrupt).toBe(false);
    expect(combined.primaryPrompt).toBe('');
  });
});
