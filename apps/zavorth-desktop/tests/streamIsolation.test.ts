import { describe, expect, it } from 'vitest';
import {
  shouldRemountMessage,
  sliceStreamingMessages,
  type StreamSlice,
} from '../src/thread/streamIsolation';

type Msg = { id: string; role?: string; text?: string };

function ids(slice: StreamSlice<Msg>) {
  return {
    frozen: slice.frozen.map((m) => m.id),
    live: slice.live?.id ?? null,
    tail: slice.tail.map((m) => m.id),
    streamingId: slice.streamingId,
  };
}

describe('sliceStreamingMessages', () => {
  const messages: Msg[] = [
    { id: 'u1', role: 'user', text: 'hi' },
    { id: 'a1', role: 'assistant', text: 'hello' },
    { id: 'u2', role: 'user', text: 'more' },
    { id: 'a2', role: 'assistant', text: 'stream…' },
  ];

  it('returns all frozen when not busy and no streaming id', () => {
    const slice = sliceStreamingMessages(messages, { busy: false });
    expect(ids(slice)).toEqual({
      frozen: ['u1', 'a1', 'u2', 'a2'],
      live: null,
      tail: [],
      streamingId: null,
    });
  });

  it('when busy, last assistant is live', () => {
    const slice = sliceStreamingMessages(messages, { busy: true });
    expect(ids(slice)).toEqual({
      frozen: ['u1', 'a1', 'u2'],
      live: 'a2',
      tail: [],
      streamingId: 'a2',
    });
  });

  it('uses explicit streamingMessageId over busy heuristic', () => {
    const slice = sliceStreamingMessages(messages, {
      busy: true,
      streamingMessageId: 'a1',
    });
    expect(ids(slice)).toEqual({
      frozen: ['u1'],
      live: 'a1',
      tail: ['u2', 'a2'],
      streamingId: 'a1',
    });
  });

  it('explicit id works even when not busy', () => {
    const slice = sliceStreamingMessages(messages, {
      busy: false,
      streamingMessageId: 'a2',
    });
    expect(slice.live?.id).toBe('a2');
    expect(slice.streamingId).toBe('a2');
    expect(slice.frozen.map((m) => m.id)).toEqual(['u1', 'a1', 'u2']);
  });

  it('unknown streamingMessageId freezes all', () => {
    const slice = sliceStreamingMessages(messages, {
      busy: true,
      streamingMessageId: 'missing',
    });
    expect(slice.live).toBeNull();
    expect(slice.streamingId).toBeNull();
    expect(slice.frozen).toHaveLength(4);
  });

  it('busy with no assistant yields no live', () => {
    const onlyUser: Msg[] = [
      { id: 'u1', role: 'user' },
      { id: 'u2', role: 'user' },
    ];
    const slice = sliceStreamingMessages(onlyUser, { busy: true });
    expect(slice.live).toBeNull();
    expect(slice.frozen).toEqual(onlyUser);
  });

  it('handles empty messages', () => {
    expect(sliceStreamingMessages([], { busy: true })).toEqual({
      frozen: [],
      live: null,
      tail: [],
      streamingId: null,
    });
  });

  it('treats missing role as non-assistant when busy', () => {
    const msgs: Msg[] = [
      { id: '1', role: 'user' },
      { id: '2' },
    ];
    const slice = sliceStreamingMessages(msgs, { busy: true });
    expect(slice.live).toBeNull();
  });

  it('picks last assistant when trailing tool/system after would not apply — last is assistant', () => {
    const msgs: Msg[] = [
      { id: 'u', role: 'user' },
      { id: 'a', role: 'assistant' },
    ];
    const slice = sliceStreamingMessages(msgs, { busy: true });
    expect(slice.live?.id).toBe('a');
    expect(slice.frozen.map((m) => m.id)).toEqual(['u']);
  });

  it('when busy and last is user, uses previous assistant', () => {
    const msgs: Msg[] = [
      { id: 'u1', role: 'user' },
      { id: 'a1', role: 'assistant' },
      { id: 'u2', role: 'user' },
    ];
    const slice = sliceStreamingMessages(msgs, { busy: true });
    expect(ids(slice)).toEqual({
      frozen: ['u1'],
      live: 'a1',
      tail: ['u2'],
      streamingId: 'a1',
    });
  });

  it('preserves object identity of live message', () => {
    const slice = sliceStreamingMessages(messages, { busy: true });
    expect(slice.live).toBe(messages[3]);
  });
});

describe('shouldRemountMessage', () => {
  it('returns false when same id and streaming', () => {
    expect(shouldRemountMessage('a', 'a', true)).toBe(false);
  });

  it('returns false when same id and not streaming', () => {
    expect(shouldRemountMessage('a', 'a', false)).toBe(false);
  });

  it('returns true when ids differ', () => {
    expect(shouldRemountMessage('a', 'b', true)).toBe(true);
    expect(shouldRemountMessage('a', 'b', false)).toBe(true);
  });
});
