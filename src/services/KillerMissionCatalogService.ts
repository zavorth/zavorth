export type KillerAudience = 'developer' | 'personal' | 'privacy';

export type KillerMission = {
  id: string;
  audience: KillerAudience;
  title: string;
  prompt: string;
  mutatesFiles: false;
  expectedSignals: string[];
  howToRun: string[];
};

export class KillerMissionCatalogService {
  public list(audience?: KillerAudience | null): KillerMission[] {
    const all = this.catalog();
    if (!audience) return all;
    return all.filter((entry) => entry.audience === audience);
  }

  public renderText(audience?: KillerAudience | null): string {
    const missions = this.list(audience);
    return [
      'Zavorth killer missions (safe / no file mutation)',
      ...missions.flatMap((mission) => [
        '',
        `[${mission.audience}] ${mission.id} — ${mission.title}`,
        `Prompt: ${mission.prompt}`,
        `Run: ${mission.howToRun.join(' | ')}`,
      ]),
    ].join('\n');
  }

  private catalog(): KillerMission[] {
    return [
      {
        id: 'killer.dev.repo-plan',
        audience: 'developer',
        title: 'Repo risk plan without changing files',
        prompt: 'Explain what this project does in plain language, list the top 5 risks, and propose a safe step-by-step plan I can approve. Do not change any files.',
        mutatesFiles: false,
        expectedSignals: ['plan', 'risk', 'approve'],
        howToRun: [
          'zavorth setup',
          'zavorth start',
          'Paste the prompt in Desktop chat or: zavorth ask "<prompt>"',
        ],
      },
      {
        id: 'killer.personal.day-plan',
        audience: 'personal',
        title: 'Daily plan with only risky steps gated',
        prompt: 'Help me plan today in simple language. Suggest three useful actions. Do not change files or send messages. If something would need approval, say so clearly.',
        mutatesFiles: false,
        expectedSignals: ['today', 'action', 'approval'],
        howToRun: [
          'zavorth setup',
          'zavorth open',
          'Use Desktop first-ask or paste the prompt',
        ],
      },
      {
        id: 'killer.privacy.memory-review',
        audience: 'privacy',
        title: 'Show what is remembered and how to forget',
        prompt: 'What do you currently remember about me with sources? If nothing has a receipt, say you did not find memory. Tell me how to review drafts and forget items.',
        mutatesFiles: false,
        expectedSignals: ['memory', 'forget', 'receipt'],
        howToRun: [
          'zavorth memory-drafts list',
          'zavorth open',
          'Paste the prompt in chat',
        ],
      },
    ];
  }
}
