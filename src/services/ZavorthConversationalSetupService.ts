import type { FirstRunPersonalizationAnswers } from './FirstRunPersonalizationService.js';
import { logger } from '../logger.js';
import { FirstRunPersonalizationService } from './FirstRunPersonalizationService.js';
import { LlmRuntimeService } from './llm/LlmRuntimeService.js';
import type { ChatMessage } from '../providers/ILlmProvider.js';
import {
  ZAVORTH_CONVERSATIONAL_SETUP_CONTRACT_VERSION,
  type ZavorthConversationalSetupAnswers,
  type ZavorthConversationalSetupContract,
  type ZavorthConversationalSetupLanguage,
  type ZavorthConversationalSetupQuestion,
  type ZavorthConversationalSetupStatus,
} from '../contracts/ZavorthConversationalSetupContract.js';
import type { ZavorthExperienceProfileId } from '../contracts/ZavorthExperienceProfileContract.js';
import { ZavorthExperienceProfileService } from './ZavorthExperienceProfileService.js';
import { asErrorLike } from '../utils/errorLike';

export type ZavorthConversationalSetupInput = {
  agentName?: unknown;
  userName?: unknown;
  preferredAddress?: unknown;
  language?: unknown;
  primaryUse?: unknown;
  intent?: unknown;
  experienceProfile?: unknown;
  detailLevel?: unknown;
  approvalChannel?: unknown;
  firstSafeMission?: unknown;
  preferredTone?: unknown;
  domain?: unknown;
  learningStyle?: unknown;
  timezone?: unknown;
  weekendPolicy?: unknown;
  apply?: boolean;
  confirmLocalProfile?: boolean;
  completeBootstrap?: boolean;
};

export type ZavorthConversationalSetupRuntime = {
  personalization?: FirstRunPersonalizationService;
  experienceProfiles?: ZavorthExperienceProfileService;
};

const SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
  /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
  /\b(?:api[_ -]?key|token|secret)\s*[:=]\s*[^\s]+/gi,
];

export class ZavorthConversationalSetupService {
  private readonly personalization: FirstRunPersonalizationService;
  private readonly experienceProfiles: ZavorthExperienceProfileService;

  constructor(runtime: ZavorthConversationalSetupRuntime = {}) {
    this.personalization = runtime.personalization || new FirstRunPersonalizationService();
    this.experienceProfiles = runtime.experienceProfiles || new ZavorthExperienceProfileService();
  }

  public buildSnapshot(input: ZavorthConversationalSetupInput = {}): ZavorthConversationalSetupContract {
    const primaryUse = clean(input.primaryUse) || clean(input.intent);
    const uiLanguage: ZavorthConversationalSetupLanguage = 'en-US';
    const experience = this.experienceProfiles.buildContract({
      profile: input.experienceProfile,
      intent: primaryUse,
      detailMode: clean(input.detailLevel),
    });
    const answers = this.buildAnswers(input, uiLanguage, experience.selected.profileId);
    const secretDetected = hasRawSecret(input);
    const questions = buildQuestions(answers);
    const missingRequired = questions.some((question) => question.required && question.status === 'pending');
    const canApply = input.apply === true && input.confirmLocalProfile === true && !secretDetected && !missingRequired;
    const blockedReason = secretDetected
      ? 'A raw secret-like value was detected in setup answers. Store credentials as SecretRefs instead.'
      : input.apply === true && input.confirmLocalProfile !== true
        ? 'Applying setup requires --confirm-local-profile so local identity files are never changed accidentally.'
        : null;
    const applyResult = canApply
      ? this.personalization.applyAnswers(this.toPersonalizationAnswers(input, answers, experience.selected.explanation), {
          completeBootstrap: input.completeBootstrap === true,
        })
      : null;

    const status = resolveStatus({
      secretDetected,
      missingRequired,
      applied: applyResult !== null,
      blockedReason,
    });

    return {
      contractVersion: ZAVORTH_CONVERSATIONAL_SETUP_CONTRACT_VERSION,
      schemaVersion: 1,
      surface: 'conversational-setup',
      status,
      uiLanguage,
      experience,
      answers,
      questions,
      writePlan: {
        previewOnly: applyResult === null,
        requiresExplicitApply: true,
        requiresLocalProfileConfirmation: true,
        targets: [
          {
            file: 'IDENTITY.md',
            purpose: 'Store the local agent name and how it introduces itself on this machine.',
            action: 'upsert-markdown-fields',
          },
          {
            file: 'USER.md',
            purpose: 'Store the local user name, preferred conversation language and collaboration preferences.',
            action: 'upsert-markdown-fields',
          },
          {
            file: 'SOUL.md',
            purpose: 'Store durable tone and collaboration calibration without raw transcripts.',
            action: 'upsert-markdown-fields',
          },
          {
            file: 'DOMAIN.md',
            purpose: 'Store domain expertise and specialization profile.',
            action: 'upsert-markdown-fields',
          },
          {
            file: 'LEARNING-STYLE.md',
            purpose: 'Store learning and explanation preferences.',
            action: 'upsert-markdown-fields',
          },
          {
            file: 'ERROR-HANDLING.md',
            purpose: 'Store error recovery strategies and defaults.',
            action: 'upsert-markdown-fields',
          },
          {
            file: 'OUTPUT-FORMAT.md',
            purpose: 'Store response formatting preferences.',
            action: 'upsert-markdown-fields',
          },
          {
            file: 'TIME-AUTOMATION.md',
            purpose: 'Store timezone, schedule, and weekend behavior policies.',
            action: 'upsert-markdown-fields',
          },
        ],
      },
      safety: {
        rawSecretsSerialized: false,
        rawSecretDetected: secretDetected,
        blockedReason,
        secretHandling: 'Credentials are never collected here. Use SecretRefs/provider setup for API keys and tokens.',
        storesOnlyLocalProfile: true,
        mutatesOnlyAfterConfirmation: true,
      },
      applyResult: applyResult
        ? {
            applied: true,
            writtenFiles: applyResult.writtenFiles,
            removedBootstrap: applyResult.removedBootstrap,
            summary: applyResult.summary,
          }
        : null,
      preview: buildPreview(answers, experience.selected.explanation),
      commands: [
        {
          command: 'zavorth onboard conversation',
          purpose: 'Preview the conversational setup questions.',
          mutatesLocalProfile: false,
        },
        {
          command: 'zavorth onboard conversation --apply --confirm-local-profile',
          purpose: 'Apply the local identity and user calibration files after review.',
          mutatesLocalProfile: true,
        },
        {
          command: 'zavorth experience --intent "I want daily personal help"',
          purpose: 'Switch or inspect the best experience profile without mutating files.',
          mutatesLocalProfile: false,
        },
      ],
      invariants: [
        'The official product UI, docs and contracts are English-first.',
        'The preferred conversation language is free text and may be followed by the LLM without becoming a UI locale.',
        'The setup flow never stores API keys, bot tokens or raw credentials; use SecretRefs instead.',
        'Preview is the default. Local profile files change only with --apply and --confirm-local-profile.',
        'Experience profile changes defaults and language, not Policy Broker authority.',
      ],
    };
  }

  public renderText(snapshot: ZavorthConversationalSetupContract): string {
    return [
      '[zavorth-setup] conversational first run',
      `status=${snapshot.status} uiLanguage=${snapshot.uiLanguage} preferredLanguage=${snapshot.answers.preferredLanguage || 'not set'}`,
      `profile=${snapshot.answers.experienceProfileId} mode=${snapshot.experience.selected.dailyMode}/${snapshot.experience.selected.detailMode}`,
      '',
      '[questions]',
      ...snapshot.questions
        .filter((q) => q.visible)
        .map((question) =>
          `- ${question.id}: ${question.status} | ${question.prompt}`,
        ),
      '',
      '[preview]',
      snapshot.preview.agentIntroduction,
      snapshot.preview.userSummary,
      snapshot.preview.operatingStyle,
      snapshot.preview.firstMission,
      '',
      '[safety]',
      `rawSecretsSerialized=${snapshot.safety.rawSecretsSerialized} rawSecretDetected=${snapshot.safety.rawSecretDetected}`,
      snapshot.safety.blockedReason ? `blocked=${snapshot.safety.blockedReason}` : 'blocked=none',
      '',
      '[apply]',
      snapshot.writePlan.previewOnly
        ? 'preview-only; add --apply --confirm-local-profile after reviewing.'
        : `applied; files=${snapshot.applyResult?.writtenFiles.length || 0}`,
      '',
    ].join('\n');
  }

  private buildAnswers(
    input: ZavorthConversationalSetupInput,
    uiLanguage: ZavorthConversationalSetupLanguage,
    experienceProfileId: ZavorthExperienceProfileId,
  ): ZavorthConversationalSetupAnswers {
    const detail = clean(input.detailLevel);
    return {
      agentName: redactSecret(clean(input.agentName)),
      userName: redactSecret(clean(input.userName)),
      preferredAddress: redactSecret(clean(input.preferredAddress)) || redactSecret(clean(input.userName)),
      uiLanguage,
      preferredLanguage: redactSecret(clean(input.language)) || 'English',
      primaryUse: redactSecret(clean(input.primaryUse) || clean(input.intent)),
      approvalChannel: redactSecret(clean(input.approvalChannel)),
      firstSafeMission: redactSecret(clean(input.firstSafeMission)),
      detailLevel: detail === 'advanced' ? 'advanced' : 'simple',
      experienceProfileId,
      domain: redactSecret(clean(input.domain)),
      learningStyle: redactSecret(clean(input.learningStyle)),
      timezone: redactSecret(clean(input.timezone)),
      weekendPolicy: redactSecret(clean(input.weekendPolicy)),
    };
  }

  private toPersonalizationAnswers(
    input: ZavorthConversationalSetupInput,
    answers: ZavorthConversationalSetupAnswers,
    explanation: string,
  ): FirstRunPersonalizationAnswers {
    const profile = answers.experienceProfileId;
    return {
      agentName: answers.agentName || 'Zavorth',
      userName: answers.userName || answers.preferredAddress || 'Operator',
      preferredAddress: answers.preferredAddress || answers.userName || 'Operator',
      primaryLanguage: answers.preferredLanguage || answers.uiLanguage,
      preferredTone: clean(input.preferredTone) || defaultTone(profile),
      responseDensity: answers.detailLevel === 'advanced' || explanation === 'audit' ? 'dense when useful; concise by default' : 'plain and concise',
      initiativeLevel: profile === 'personal'
        ? 'proactive with reminders and guidance; ask before risky action'
        : 'proactive with planning, previews and safe next steps',
      candorLevel: 'honest, respectful and direct',
      challengePreference: profile === 'business' || profile === 'developer' || profile === 'power'
        ? 'challenge weak plans early with evidence'
        : 'gently point out risks and better options',
      externalActionPosture: 'ask before writes, spending, public messages, installs, network-sensitive actions or irreversible changes',
      domain: answers.domain,
      learningStyle: answers.learningStyle,
      errorHandlingDefault: null,
      outputFormatDefault: null,
      weekendPolicy: answers.weekendPolicy,
      timezone: answers.timezone,
    };
  }

  public async runFirstMessageIntake(
    sessionId: string,
    history: ChatMessage[],
    workspaceHint?: { type: string; suggestedMission: string },
  ): Promise<{
    reply: string;
    finished: boolean;
  }> {
    const llmService = new LlmRuntimeService();

    // 1. Ask LLM to extract JSON from the history
    const extractionPrompt = `You are a helper parsing a conversation history between a user and an assistant who is configuring the Zavorth agent.
Analyze the conversation history and extract the following parameters as JSON. Return ONLY a valid JSON object. If a parameter is not mentioned, return null.

Fields:
- agentName: name for the agent (e.g. Zavorth, Vritra)
- userName: name of the user
- language: primary language for communication (e.g. Portuguese, English)
- experienceProfile: must be one of: 'personal', 'creator', 'developer', 'business', 'power'
- detailLevel: must be 'simple' or 'advanced'
- primaryUse: what the user wants to do with the agent

Example response format:
{
  "agentName": null,
  "userName": "John",
  "language": "Portuguese",
  "experienceProfile": "developer",
  "detailLevel": "advanced",
  "primaryUse": "programming in Python"
}

Here is the conversation history:
${history.map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}
`;

    let extracted: any = {};
    try {
      const response = await llmService.chat([
        { role: 'user', content: extractionPrompt }
      ]);
      const content = response.content || '';
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}') + 1;
      if (jsonStart !== -1 && jsonEnd !== -1) {
        extracted = JSON.parse(content.substring(jsonStart, jsonEnd));
      }
    } catch (error: unknown) {
      const err = asErrorLike(error);
      logger.error('Extraction from onboarding history failed', err);
    }

    // 2. Build snapshot with extracted answers
    const snapshot = this.buildSnapshot({
      agentName: extracted.agentName,
      userName: extracted.userName,
      preferredAddress: extracted.userName,
      language: extracted.language,
      experienceProfile: extracted.experienceProfile,
      detailLevel: extracted.detailLevel,
      primaryUse: extracted.primaryUse,
    });

    const isAllAnswered = snapshot.questions.every((q) => q.status === 'answered' || !q.required);

    if (snapshot.status === 'ready' || isAllAnswered) {
      // 3. Apply setup!
      const applySnapshot = this.buildSnapshot({
        agentName: extracted.agentName,
        userName: extracted.userName,
        preferredAddress: extracted.userName,
        language: extracted.language,
        experienceProfile: extracted.experienceProfile,
        detailLevel: extracted.detailLevel,
        primaryUse: extracted.primaryUse,
        apply: true,
        confirmLocalProfile: true,
        completeBootstrap: true,
      });

      const mission = workspaceHint?.suggestedMission || 'revisar os arquivos locais';
      
      const summaryPrompt = `Onboarding conversational setup is complete. Write a warm, professional, and concise greeting (max 3-4 sentences) summarizing the applied configuration and suggesting the first mission:
- User name: ${extracted.userName || 'Operator'}
- Language: ${extracted.language || 'English'}
- Profile: ${extracted.experienceProfile || 'personal'}
- Suggested Mission: ${mission}

Make sure to speak in the user's preferred language (e.g. Portuguese if language is Portuguese).
`;
      const replyResponse = await llmService.chat([
        { role: 'user', content: summaryPrompt }
      ]);

      return {
        reply: replyResponse.content || 'Setup concluído! Estou pronto para ajudar.',
        finished: true,
      };
    } else {
      // Find the first pending required question
      const nextQuestion = snapshot.questions.find((q) => q.status === 'pending' && q.required)
        || snapshot.questions.find((q) => q.status === 'pending');

      const questionPrompt = `Onboarding conversation for Zavorth.
The user is answering questions to configure their local profile. We need to ask them about the field: "${nextQuestion?.label}".
Prompt description: "${nextQuestion?.prompt}"
Available choices (if choice type): ${nextQuestion?.choices ? nextQuestion.choices.join(', ') : 'free text'}

Ask the user this question in a friendly, conversational, and natural way. Keep it to 1-2 sentences.
Speak in the user's preferred language if known (default to Portuguese if history seems to be in Portuguese or English if not). Do not output anything else, just the question.
`;
      const replyResponse = await llmService.chat([
        { role: 'user', content: questionPrompt }
      ]);

      return {
        reply: replyResponse.content || nextQuestion?.prompt || 'Qual seu nome?',
        finished: false,
      };
    }
  }
}

function resolveStatus(input: {
  secretDetected: boolean;
  missingRequired: boolean;
  applied: boolean;
  blockedReason: string | null;
}): ZavorthConversationalSetupStatus {
  if (input.secretDetected || input.blockedReason) {
    return 'blocked';
  }
  if (input.applied) {
    return 'applied';
  }
  return input.missingRequired ? 'needs_input' : 'ready';
}

function buildQuestions(answers: ZavorthConversationalSetupAnswers): ZavorthConversationalSetupQuestion[] {
  const profile = answers.experienceProfileId;
  const isTechnical = profile === 'developer' || profile === 'business' || profile === 'power';
  const isGoverned = profile === 'business' || profile === 'power';

  const rows: Array<Omit<ZavorthConversationalSetupQuestion, 'status' | 'answerPreview'> & { answer: string | null }> = [
    {
      id: 'agent-name',
      label: 'Agent name',
      prompt: 'What should this agent be called?',
      kind: 'text',
      required: true,
      visible: true,
      answer: answers.agentName,
    },
    {
      id: 'user-name',
      label: 'Your name',
      prompt: 'What should Zavorth call you?',
      kind: 'text',
      required: true,
      visible: true,
      answer: answers.preferredAddress || answers.userName,
    },
    {
      id: 'preferred-language',
      label: 'Preferred conversation language',
      prompt: 'Which language should Zavorth use when speaking with you?',
      kind: 'text',
      required: true,
      visible: true,
      answer: answers.preferredLanguage,
    },
    {
      id: 'experience-profile',
      label: 'Experience profile',
      prompt: 'Will you use Zavorth for daily life, creation, code, business or advanced operation?',
      kind: 'choice',
      required: true,
      visible: true,
      choices: ['personal', 'creator', 'developer', 'business', 'power'],
      answer: answers.experienceProfileId,
    },
    {
      id: 'detail-level',
      label: 'Detail level',
      prompt: 'Do you prefer simple or advanced detail?',
      kind: 'choice',
      required: true,
      visible: true,
      choices: ['simple', 'advanced'],
      answer: answers.detailLevel,
    },
    {
      id: 'primary-use',
      label: 'Primary use',
      prompt: 'What do you most want to do with Zavorth?',
      kind: 'text',
      required: false,
      visible: true,
      answer: answers.primaryUse,
    },
    {
      id: 'approval-channel',
      label: 'Approvals',
      prompt: 'Where should sensitive approvals appear?',
      kind: 'choice',
      required: false,
      visible: isGoverned,
      visibleReason: 'Relevant for business and power profiles with governed workflows.',
      choices: ['zavorthControl', 'satellite', 'telegram', 'cli'],
      answer: answers.approvalChannel,
    },
    {
      id: 'first-safe-mission',
      label: 'First mission',
      prompt: 'Which safe first mission should Zavorth suggest?',
      kind: 'text',
      required: false,
      visible: isTechnical,
      visibleReason: 'Relevant for developer, business and power profiles.',
      answer: answers.firstSafeMission,
    },
    {
      id: 'domain',
      label: 'Domain expertise',
      prompt: 'What is your primary domain of expertise?',
      kind: 'text',
      required: false,
      visible: isTechnical,
      visibleReason: 'Relevant for developer, business and power profiles.',
      answer: answers.domain,
    },
    {
      id: 'learning-style',
      label: 'Learning style',
      prompt: 'How do you prefer to learn new things?',
      kind: 'choice',
      required: false,
      visible: isTechnical,
      visibleReason: 'Relevant for developer, business and power profiles.',
      choices: ['examples-first', 'theory-first', 'hands-on', 'visual', 'step-by-step'],
      answer: answers.learningStyle,
    },
    {
      id: 'timezone',
      label: 'Timezone',
      prompt: 'What is your timezone?',
      kind: 'text',
      required: false,
      visible: true,
      answer: answers.timezone,
    },
    {
      id: 'weekend-policy',
      label: 'Weekend behavior',
      prompt: 'Should I behave differently on weekends?',
      kind: 'choice',
      required: false,
      visible: true,
      choices: ['normal', 'reduced-activity', 'urgent-only'],
      answer: answers.weekendPolicy,
    },
  ];

  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    prompt: row.prompt,
    kind: row.kind,
    required: row.required,
    visible: row.visible,
    ...(row.visibleReason ? { visibleReason: row.visibleReason } : {}),
    status: row.answer ? 'answered' : 'pending',
    answerPreview: row.answer || null,
    ...(row.choices ? { choices: row.choices } : {}),
  }));
}

function buildPreview(
  answers: ZavorthConversationalSetupAnswers,
  explanation: string,
): ZavorthConversationalSetupContract['preview'] {
  const agent = answers.agentName || 'Zavorth';
  const user = answers.preferredAddress || answers.userName || 'Operator';
  return {
    agentIntroduction: `I am ${agent}, your governed agent runtime.`,
    userSummary: `I will call you ${user}, speak with you in ${answers.preferredLanguage || 'English'} when possible, and adapt the experience for the ${answers.experienceProfileId} profile.`,
    operatingStyle: `${answers.detailLevel} detail; ${explanation} explanations; sensitive actions still require approval and receipts.`,
    firstMission: answers.firstSafeMission
      ? `Suggested first mission: ${answers.firstSafeMission}.`
      : 'Suggested first mission: a safe read-only review to validate the environment.',
  };
}

function hasRawSecret(input: ZavorthConversationalSetupInput): boolean {
  const values = [
    input.agentName,
    input.userName,
    input.preferredAddress,
    input.language,
    input.primaryUse,
    input.intent,
    input.experienceProfile,
    input.approvalChannel,
    input.firstSafeMission,
    input.preferredTone,
    input.domain,
    input.learningStyle,
    input.timezone,
    input.weekendPolicy,
  ].map((value) => String(value || ''));
  return values.some((value) => SECRET_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(value);
  }));
}

function redactSecret(value: string | null): string | null {
  if (!value) {
    return null;
  }
  let result = value;
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, '[REDACTED_SECRET]');
  }
  return result;
}

function defaultTone(profile: ZavorthExperienceProfileId): string {
  if (profile === 'business') {
    return 'professional, concise and audit-friendly';
  }
  if (profile === 'developer' || profile === 'power') {
    return 'technical, direct and collaborative';
  }
  if (profile === 'creator') {
    return 'clear, creative and practical';
  }
  return 'warm, simple and practical';
}

function clean(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text ? text : null;
}
