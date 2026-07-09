import fs from 'fs';
import path from 'path';
import { logger } from '../../logger.js';

export interface CircuitState {
  id: string;
  provider: string;
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  last_failure: string;
  last_success: string;
  opened_at: string | null;
  threshold: number;
  timeout_ms: number;
}

export class CircuitBreakerService {
  private readonly storageDir: string;
  private circuits: Map<string, CircuitState> = new Map();
  private dirty = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options?: { storageDir?: string }) {
    this.storageDir = options?.storageDir || path.join(process.cwd(), 'data', 'runtime', 'circuit-breaker');
    if (!fs.existsSync(this.storageDir)) fs.mkdirSync(this.storageDir, { recursive: true });
    this.loadCircuits();
  }

  private loadCircuits(): void {
    const p = path.join(this.storageDir, 'circuits.json');
    if (!fs.existsSync(p)) return;
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      if (Array.isArray(data)) for (const c of data) this.circuits.set(c.id, c);
    } catch (error: unknown) {/* ignore */ logger.warn('[Circuit Breaker] JSON parse failed', error); }
  }

  private scheduleFlush(): void {
    this.dirty = true;
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (!this.dirty) return;
      this.dirty = false;
      try {
        if (!fs.existsSync(this.storageDir)) {
          fs.mkdirSync(this.storageDir, { recursive: true });
        }
        fs.writeFileSync(path.join(this.storageDir, 'circuits.json'), JSON.stringify(Array.from(this.circuits.values()), null, 2), 'utf-8');
      } catch (error: unknown) {
        logger.warn('[DeferredFlush] deferred flush failed', error);
      }
    }, 2000);
    if (this.flushTimer && typeof this.flushTimer === 'object' && 'unref' in this.flushTimer) {
      (this.flushTimer as NodeJS.Timeout).unref();
    }
  }

  public getCircuit(provider: string): CircuitState {
    let circuit = this.circuits.get(provider);
    if (!circuit) {
      circuit = {
        id: provider, provider, state: 'closed', failures: 0, successes: 0,
        last_failure: '', last_success: '', opened_at: null,
        threshold: 5, timeout_ms: 60000,
      };
      this.circuits.set(provider, circuit);
    }
    return circuit;
  }

  public canExecute(provider: string): boolean {
    const circuit = this.getCircuit(provider);
    if (circuit.state === 'closed') return true;
    if (circuit.state === 'open') {
      const openedAt = new Date(circuit.opened_at!).getTime();
      if (Date.now() - openedAt > circuit.timeout_ms) {
        circuit.state = 'half-open';
        this.scheduleFlush();
        return true;
      }
      return false;
    }
    return true;
  }

  public recordSuccess(provider: string): void {
    const circuit = this.getCircuit(provider);
    circuit.successes++;
    circuit.last_success = new Date().toISOString();
    if (circuit.state === 'half-open') {
      circuit.state = 'closed';
      circuit.failures = 0;
    }
    this.scheduleFlush();
  }

  public recordFailure(provider: string): void {
    const circuit = this.getCircuit(provider);
    circuit.failures++;
    circuit.last_failure = new Date().toISOString();
    if (circuit.failures >= circuit.threshold) {
      circuit.state = 'open';
      circuit.opened_at = new Date().toISOString();
    }
    this.scheduleFlush();
  }

  public reset(provider: string): string {
    const circuit = this.getCircuit(provider);
    circuit.state = 'closed';
    circuit.failures = 0;
    circuit.successes = 0;
    circuit.opened_at = null;
    this.scheduleFlush();
    return `Circuit "${provider}" reset to closed.`;
  }

  public getCircuits(): string {
    if (this.circuits.size === 0) return 'No circuits configured.';
    const lines: string[] = ['Circuit Breakers:'];
    for (const [, c] of this.circuits) {
      const stateIcon = c.state === 'closed' ? '[OK]' : c.state === 'open' ? '[FAIL]' : '[WARN]';
      lines.push(`  ${stateIcon} ${c.provider}: ${c.state} (failures: ${c.failures}/${c.threshold})`);
    }
    return lines.join('\n');
  }

  public getStats(): string {
    const circuits = Array.from(this.circuits.values());
    const open = circuits.filter((c) => c.state === 'open').length;
    const halfOpen = circuits.filter((c) => c.state === 'half-open').length;
    const closed = circuits.filter((c) => c.state === 'closed').length;
    return [
      'Circuit Breaker Stats:',
      `  Total: ${circuits.length}`,
      `  Closed: ${closed}`,
      `  Open: ${open}`,
      `  Half-open: ${halfOpen}`,
    ].join('\n');
  }
}
