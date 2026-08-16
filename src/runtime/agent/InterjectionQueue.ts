/**
 * Mid-Turn Interjection & Steering Queue.
 * Allows queueing asynchronous operator hints and directives during active execution loops
 * and injecting them into the next model step without breaking in-flight tool progress.
 */

import type { ChatMessage } from '../../adapters/llm/LLMAdapterContract.js';

export interface InterjectionItem {
  id: string;
  text: string;
  source: string;
  timestamp: string;
}

export class InterjectionQueue {
  private static queue: InterjectionItem[] = [];

  static enqueue(text: string, source = 'operator-cli'): InterjectionItem {
    const item: InterjectionItem = {
      id: `steer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: text.trim(),
      source,
      timestamp: new Date().toISOString(),
    };
    this.queue.push(item);
    return item;
  }

  static hasPending(): boolean {
    return this.queue.length > 0;
  }

  static peekAll(): InterjectionItem[] {
    return [...this.queue];
  }

  static dequeueAll(): InterjectionItem[] {
    const items = [...this.queue];
    this.queue = [];
    return items;
  }

  static clear(): void {
    this.queue = [];
  }

  /**
   * Formats pending interjections into a canonical user steering message.
   */
  static formatAsMessage(items: InterjectionItem[]): ChatMessage | null {
    if (items.length === 0) return null;

    const directives = items.map((it) => `- ${it.text}`).join('\n');
    const content = `<operator_steering_note>\nThe operator provided live directives while tools were executing:\n${directives}\n\nIncorporate these directives into your current step.\n</operator_steering_note>`;

    return {
      role: 'user',
      content,
    };
  }
}
