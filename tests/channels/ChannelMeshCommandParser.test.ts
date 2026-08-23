import {
  parseChannelMeshApprovalCommand,
  parseChannelMeshApprovalToken,
} from '../../src/channels/commands/ChannelMeshCommandParser.js';

describe('ChannelMeshCommandParser', () => {
  describe('explicit commands', () => {
    it('parses approve with all scopes and verb aliases', () => {
      expect(parseChannelMeshApprovalCommand('/approve abc123')).toEqual({
        action: 'approve',
        ref: 'abc123',
        choice: 'once',
      });
      expect(parseChannelMeshApprovalCommand('/approve abc123 session')).toMatchObject({ choice: 'session' });
      expect(parseChannelMeshApprovalCommand('/accept abc123 always')).toMatchObject({ action: 'approve' });
    });

    it('parses deny and reject as the same deny action', () => {
      expect(parseChannelMeshApprovalCommand('/deny abc123')).toEqual({
        action: 'deny',
        ref: 'abc123',
        choice: 'always',
      });
      expect(parseChannelMeshApprovalCommand('/reject abc123')).toMatchObject({ action: 'deny' });
    });

    it('rejects malformed commands instead of guessing', () => {
      expect(parseChannelMeshApprovalCommand('/approve')).toBeNull();
      expect(parseChannelMeshApprovalCommand('approve abc123')).toBeNull();
      expect(parseChannelMeshApprovalCommand('/approve abc 123 extra')).toBeNull();
    });
  });

  describe('fast-path tokens', () => {
    it('maps menu ordinals', () => {
      expect(parseChannelMeshApprovalToken('1')).toEqual({ kind: 'ordinal', ordinal: 1 });
      expect(parseChannelMeshApprovalToken('9')).toEqual({ kind: 'ordinal', ordinal: 9 });
      expect(parseChannelMeshApprovalToken('0')).toBeNull();
      expect(parseChannelMeshApprovalToken('12')).toBeNull();
    });

    it('maps closed decision word sets', () => {
      expect(parseChannelMeshApprovalToken('y')).toEqual({ kind: 'decision', action: 'approve', choice: 'once' });
      expect(parseChannelMeshApprovalToken('OK')).toEqual({ kind: 'decision', action: 'approve', choice: 'once' });
      expect(parseChannelMeshApprovalToken('always')).toEqual({
        kind: 'decision',
        action: 'approve',
        choice: 'always',
      });
      expect(parseChannelMeshApprovalToken('no')).toEqual({ kind: 'decision', action: 'deny', choice: 'once' });
      expect(parseChannelMeshApprovalToken('cancel')).toEqual({ kind: 'decision', action: 'deny', choice: 'once' });
    });

    it('never matches natural language prose', () => {
      expect(parseChannelMeshApprovalToken('yes please go ahead and do it')).toBeNull();
      expect(parseChannelMeshApprovalToken('aprova isso por favor')).toBeNull();
      expect(parseChannelMeshApprovalToken('can you approve this?')).toBeNull();
    });
  });
});
