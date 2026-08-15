import { buildLearnedKnowledgeHub } from '../../../src/services/learned-knowledge/index.js';


describe('LearnedKnowledgeHub', () => {
  it('returns four pillar cards with cli and slash deep links (English-canonical)', () => {
    const hub = buildLearnedKnowledgeHub({
      userId: 'hub-user',
      projectRoot: __dirname,
    });
    expect(hub.ok).toBe(true);
    expect(hub.plane).toBe('learned-knowledge');
    expect(hub.cards).toHaveLength(4);
    const ids = hub.cards.map((c) => c.id).sort();
    expect(ids).toEqual(['about-you', 'conversation', 'knowledge', 'workflows']);
    for (const card of hub.cards) {
      expect(card.label).toBeTruthy();
      // No bilingual *Pt primary fields — English is source of truth.
      expect((card as { labelPt?: string }).labelPt).toBeUndefined();
      expect((card as { summaryPt?: string }).summaryPt).toBeUndefined();
      expect(card.cli).toMatch(/zavorth/);
      expect(card.slash).toMatch(/\//);
      expect(card.deepLink).toBeTruthy();
    }
    expect(hub.oneLiner).toMatch(/workflows|conversations|knowledge/i);
    expect((hub as { oneLinerPt?: string }).oneLinerPt).toBeUndefined();
    expect(hub.docs).toMatch(/learned-knowledge-plane/);
  });

  it('optionally includes advanced and storyPreview', () => {
    const hub = buildLearnedKnowledgeHub({
      userId: 'hub-user',
      projectRoot: __dirname,
    });
    // Still exactly four pillar cards
    expect(hub.cards).toHaveLength(4);

    if (hub.advanced) {
      expect(typeof hub.advanced.fileIndex.available).toBe('boolean');
      expect(hub.advanced.fileIndex.dockerConsentPath).toBeTruthy();
      expect(hub.advanced.fileIndex.setupHint).toBeTruthy();
      expect(hub.advanced.dreamCycle.previewOnly).toBe(true);
      expect(hub.advanced.dreamCycle.cli).toMatch(/consolidate/);
      expect(hub.advanced.dreamCycle.schedulerCli).toMatch(/mnemos:dream-cycle/);
      expect(hub.advanced.dreamCycle.nextEligibleHint).toBeTruthy();
      expect(hub.advanced.preferenceSpineNote).toBeTruthy();
    }

    if (hub.storyPreview) {
      expect(typeof hub.storyPreview.eventCount).toBe('number');
      expect(hub.storyPreview.summary).toBeTruthy();
      expect(hub.storyPreview.cli).toMatch(/story/);
      expect(Array.isArray(hub.storyPreview.events)).toBe(true);
      expect(hub.storyPreview.events?.length).toBe(hub.storyPreview.eventCount);
      expect(hub.storyPreview.limit).toBe(12);
      expect((hub.storyPreview as { summaryPt?: string }).summaryPt).toBeUndefined();
    }
  });
});
