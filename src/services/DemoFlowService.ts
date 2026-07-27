export type DemoScenario = {
  key: string;
  title: string;
  objective: string;
  prompt: string;
  highlight: string[];
  speakerNote: string;
  successSignal: string;
  permissionNote?: string;
};

export class DemoFlowService {
  private readonly scenarios: DemoScenario[] = [
    {
      key: 'research',
      title: 'Web search',
      objective: 'Show that Zavorth answers everyday questions without sounding too technical.',
      prompt: '/task search the web whether leaving a notebook lid almost closed causes long-term damage',
      highlight: [
        'Zavorth responds via the structured web search route, without asking for AI Studio unnecessarily.',
        'The answer should come out clear, practical and without internal jargon.',
      ],
      speakerNote: 'Use this step to show that it solves a common question as an assistant, not as a technical panel.',
      successSignal: 'The answer arrives in the chat itself, with simple language and immediate utility.',
    },
    {
      key: 'files',
      title: 'Files',
      objective: 'Show folder listing, specific permission and file sending.',
      prompt: '/file send me the index.html file from the C:/workspace/zavorth-web folder',
      highlight: [
        'If the folder is outside the allowed area, Zavorth opens a specific read-only approval.',
        'After approval, it resumes on its own and sends the file correctly.',
      ],
      speakerNote: 'The focus here is showing security with comfort: the user approves only that folder and the task continues on its own.',
      successSignal: 'The chat shows the approval, resumes the flow and sends the requested file as a document.',
      permissionNote: 'If a permission appears, highlight that it is specific, read-only and limited to this task or project.',
    },
    {
      key: 'workflow',
      title: 'Composed workflow',
      objective: 'Show that Zavorth chains larger stages instead of answering shallowly.',
      prompt: '/workflow research research the local AI market and deliver a short briefing',
      highlight: [
        'This flow shows research, synthesis and final delivery within the same request.',
        'The perception here is of an orchestrator, not just a chatbot.',
      ],
      speakerNote: 'It is worth reinforcing that it does not answer shallowly; it chains stages and returns a ready deliverable.',
      successSignal: 'The final result appears as a synthesized briefing, not as a raw list of technical steps.',
    },
    {
      key: 'stitch',
      title: 'Generation with Stitch',
      objective: 'Show real visual generation with artifact delivery.',
      prompt: '/stitch create a modern landing page for a task app with hero, CTA and benefits section',
      highlight: [
        'Stitch returns an image and HTML, and Zavorth treats it as a first-class artifact.',
        'This is one of the strongest demos for showing real creation, not just text.',
      ],
      speakerNote: 'Use this part to show real visual creation and artifact delivery, not just conversation.',
      successSignal: 'Zavorth delivers image, HTML or artifact link in an organized manner in the chat.',
    },
  ];

  public formatOverview(options: { demoModeEnabled?: boolean } = {}): string {
    const lines = [
      'Zavorth demo script',
      '',
      options.demoModeEnabled ? 'Demo mode: active and ready for presentation.' : 'Demo mode: inactive. Use /demo on to prepare Zavorth before presenting.',
      '',
      'Before starting:',
      '- Activate /demo on to clean up the experience and reduce internal jargon.',
      '- If you want more control over the presentation, combine with /operator on.',
      '',
      'Ready scenes to show:',
    ];

    for (const scenario of this.scenarios) {
      lines.push(`- ${scenario.title}: /demo ${scenario.key}`);
    }

    lines.push('', 'Suggested guided sequence:');
    lines.push('- /demo start to open the guided presentation');
    lines.push('- /demo next to advance step by step');
    lines.push('- /demo short to see the shortened version');
    lines.push('1. /demo research');
    lines.push('2. /demo files');
    lines.push('3. /demo workflow');
    lines.push('4. /demo stitch');
    lines.push('', 'Suggested closing: /demo pitch or /status');

    return lines.join('\n');
  }

  public formatPitch(): string {
    return [
      'Short Zavorth pitch',
      '',
      'Zavorth is an intelligent operational assistant that transforms natural language requests into real actions, with memory, security and several specialized executors underneath.',
      '',
      'Instead of being just a chatbot, it works as a personal command layer: it understands the request, chooses the best route, asks for approval when necessary and delivers the result on the right channel.',
      '',
      'How to summarize in a short conversation:',
      '- it searches, organizes and executes',
      '- it treats security as part of the experience',
      '- it delivers text, files and visual results',
      '',
      'Highlights to show:',
      '- clear web search without jargon',
      '- file reading and sending with specific permission',
      '- composed workflows',
      '- visual generation with Stitch',
    ].join('\n');
  }

  public formatChecklist(): string {
    return [
      'Zavorth demo checklist',
      '',
      'Preparation:',
      '- /demo on',
      '- confirm /status and /tasks',
      '',
      'Sequence:',
      '- /demo start',
      '- use /demo next until all stages are complete',
      '',
      'Closing:',
      '- /demo pitch',
      '- /status',
    ].join('\n');
  }

  public formatScenario(key: string): string | null {
    const scenario = this.scenarios.find((entry) => entry.key === key);
    if (!scenario) {
      return null;
    }

    return [
      `Demo scene: ${scenario.title}`,
      '',
      `Objective: ${scenario.objective}`,
      '',
      'Suggested prompt:',
      scenario.prompt,
      '',
      'What to show:',
      ...scenario.highlight.map((line) => `- ${line}`),
      '',
      `Support note: ${scenario.speakerNote}`,
      `Success signal: ${scenario.successSignal}`,
      scenario.permissionNote ? `If permission appears: ${scenario.permissionNote}` : null,
    ].join('\n');
  }

  public formatFullRunbook(): string {
    const lines = ['Complete Zavorth demo', ''];

    for (const scenario of this.scenarios) {
      lines.push(`Stage: ${scenario.title}`);
      lines.push(`Objective: ${scenario.objective}`);
      lines.push(`Prompt: ${scenario.prompt}`);
      lines.push(`Support note: ${scenario.speakerNote}`);
      lines.push(`Success signal: ${scenario.successSignal}`);
      if (scenario.permissionNote) {
        lines.push(`If permission appears: ${scenario.permissionNote}`);
      }
      lines.push('What to show:');
      lines.push(...scenario.highlight.map((line) => `- ${line}`));
      lines.push('');
    }

    lines.push('Suggested closing:');
    lines.push('- Show /tasks to reinforce the task hub.');
    lines.push('- Show /status to prove the runtime is supervised.');

    return lines.join('\n').trim();
  }

  public formatShortPresentation(): string {
    return [
      'Short Zavorth presentation',
      '',
      'Suggested opening:',
      'Present Zavorth as an operational assistant that searches, executes and delivers securely.',
      '',
      'Short sequence to show live:',
      `1. ${this.scenarios[0].prompt}`,
      `2. ${this.scenarios[1].prompt}`,
      '',
      'Support note:',
      'Start with an everyday question and then show a file request to prove utility and control.',
      '',
      'Suggested closing:',
      'Show /tasks or /status to reinforce that it orchestrates and tracks real tasks.',
    ].join('\n');
  }

  public getScenarios(): DemoScenario[] {
    return [...this.scenarios];
  }

  public formatGuidedStep(index: number): string | null {
    const scenario = this.scenarios[index];
    if (!scenario) {
      return null;
    }

    return [
      `Step ${index + 1}/${this.scenarios.length}: ${scenario.title}`,
      '',
      `Objective: ${scenario.objective}`,
      '',
      'Prompt to use now:',
      scenario.prompt,
      '',
      'What to show on screen:',
      ...scenario.highlight.map((line) => `- ${line}`),
      '',
      `Support note: ${scenario.speakerNote}`,
      `Success signal: ${scenario.successSignal}`,
      scenario.permissionNote ? `If permission appears: ${scenario.permissionNote}` : null,
      '',
      index < this.scenarios.length - 1
        ? 'When this stage is complete, use /demo next.'
        : 'This is the last stage. To restart the sequence, use /demo reset.',
    ].join('\n');
  }

  public formatGuidedStart(): string {
    return [
      'Guided sequence started.',
      '',
      'How to open the presentation:',
      'Start by saying that Zavorth is not just a chat: it searches, executes, asks for approval when necessary and delivers the result in the same flow.',
      '',
      'Now let us move to the first scene.',
    ].join('\n');
  }

  public formatGuidedCompletion(): string {
    return [
      'Guided sequence completed.',
      '',
      'Suggested closing:',
      '- use /demo pitch to close with the product vision',
      '- use /tasks to reinforce task tracking',
      '- use /status to show the runtime is supervised',
      '',
      'If you want to run everything again, use /demo reset and then /demo start.',
    ].join('\n');
  }
}
