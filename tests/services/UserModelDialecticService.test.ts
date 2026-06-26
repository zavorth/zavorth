import fs from 'fs';
import os from 'os';
import path from 'path';

import { UserModelDialecticService } from '../../src/services/UserModelDialecticService.js';

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'zavorth-dialectic-test-'));
}

describe('UserModelDialecticService', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should create default profile with questions', () => {
      const svc = new UserModelDialecticService({ homeRoot: tmpDir });
      const profile = svc.getProfile();
      expect(profile.questions.length).toBeGreaterThan(0);
      expect(profile.confidence).toBe(0);
      expect(profile.totalAnswered).toBe(0);
    });

    it('should have questions across all categories', () => {
      const svc = new UserModelDialecticService({ homeRoot: tmpDir });
      const categories = new Set(svc.getProfile().questions.map((q) => q.category));
      expect(categories.has('communication_style')).toBe(true);
      expect(categories.has('work_preferences')).toBe(true);
      expect(categories.has('personality')).toBe(true);
    });
  });

  describe('getNextQuestion', () => {
    it('should return first unanswered question', () => {
      const svc = new UserModelDialecticService({ homeRoot: tmpDir });
      const q = svc.getNextQuestion();
      expect(q).not.toBeNull();
      expect(q!.answer).toBeNull();
    });

    it('should return null when all questions answered', () => {
      const svc = new UserModelDialecticService({ homeRoot: tmpDir });
      const questions = svc.getProfile().questions;
      for (const q of questions) {
        svc.recordAnswer(q.id, 'test answer');
      }
      expect(svc.getNextQuestion()).toBeNull();
    });

    it('should skip already answered questions', () => {
      const svc = new UserModelDialecticService({ homeRoot: tmpDir });
      const first = svc.getNextQuestion()!;
      svc.recordAnswer(first.id, 'answered');
      const next = svc.getNextQuestion()!;
      expect(next.id).not.toBe(first.id);
    });
  });

  describe('recordAnswer', () => {
    it('should record answer and update profile', () => {
      const svc = new UserModelDialecticService({ homeRoot: tmpDir });
      const q = svc.getNextQuestion()!;
      svc.recordAnswer(q.id, 'Direto e curto');

      const profile = svc.getProfile();
      expect(profile.totalAnswered).toBe(1);
      expect(profile.confidence).toBeGreaterThan(0);
      expect(profile.userTraits[q.category]).toBe('Direto e curto');
    });

    it('should persist to disk', () => {
      const svc = new UserModelDialecticService({ homeRoot: tmpDir });
      const q = svc.getNextQuestion()!;
      svc.recordAnswer(q.id, 'test answer');

      const svc2 = new UserModelDialecticService({ homeRoot: tmpDir });
      expect(svc2.getProfile().totalAnswered).toBe(1);
    });

    it('should ignore invalid question id', () => {
      const svc = new UserModelDialecticService({ homeRoot: tmpDir });
      svc.recordAnswer('nonexistent', 'answer');
      expect(svc.getProfile().totalAnswered).toBe(0);
    });
  });

  describe('getTrait', () => {
    it('should return trait for answered category', () => {
      const svc = new UserModelDialecticService({ homeRoot: tmpDir });
      const q = svc.getNextQuestion()!;
      svc.recordAnswer(q.id, 'my preference');
      expect(svc.getTrait(q.category)).toBe('my preference');
    });

    it('should return null for unanswered category', () => {
      const svc = new UserModelDialecticService({ homeRoot: tmpDir });
      expect(svc.getTrait('communication_style')).toBeNull();
    });
  });

  describe('getProgress', () => {
    it('should report correct counts', () => {
      const svc = new UserModelDialecticService({ homeRoot: tmpDir });
      const progress = svc.getProgress();
      expect(progress.total).toBeGreaterThan(0);
      expect(progress.answered).toBe(0);
      expect(progress.confidence).toBe(0);
    });

    it('should update after answering', () => {
      const svc = new UserModelDialecticService({ homeRoot: tmpDir });
      const q = svc.getNextQuestion()!;
      svc.recordAnswer(q.id, 'answer');
      const progress = svc.getProgress();
      expect(progress.answered).toBe(1);
      expect(progress.confidence).toBeGreaterThan(0);
    });
  });

  describe('resetProfile', () => {
    it('should reset all answers', () => {
      const svc = new UserModelDialecticService({ homeRoot: tmpDir });
      const q = svc.getNextQuestion()!;
      svc.recordAnswer(q.id, 'answer');
      expect(svc.getProfile().totalAnswered).toBe(1);

      svc.resetProfile();
      expect(svc.getProfile().totalAnswered).toBe(0);
      expect(svc.getProfile().confidence).toBe(0);
    });
  });

  describe('persistence', () => {
    it('should load existing profile on init', () => {
      const svc1 = new UserModelDialecticService({ homeRoot: tmpDir });
      const q = svc1.getNextQuestion()!;
      svc1.recordAnswer(q.id, 'persistent answer');

      const svc2 = new UserModelDialecticService({ homeRoot: tmpDir });
      expect(svc2.getProfile().totalAnswered).toBe(1);
      expect(svc2.getTrait(q.category)).toBe('persistent answer');
    });
  });
});
