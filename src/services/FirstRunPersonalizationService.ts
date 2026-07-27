import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { WakeWordSyncService } from './WakeWordSyncService.js';
import { logger } from '../logger.js';

export type FirstRunPersonalizationAnswers = {
  agentName?: string | null;
  userName?: string | null;
  preferredAddress?: string | null;
  primaryLanguage?: string | null;
  preferredTone?: string | null;
  responseDensity?: string | null;
  initiativeLevel?: string | null;
  candorLevel?: string | null;
  challengePreference?: string | null;
  externalActionPosture?: string | null;
  domain?: string | null;
  learningStyle?: string | null;
  errorHandlingDefault?: string | null;
  outputFormatDefault?: string | null;
  weekendPolicy?: string | null;
  timezone?: string | null;
};

export type FirstRunPersonalizationStatus = {
  pending: boolean;
  reasons: string[];
  files: {
    identity: string;
    soul: string;
    user: string;
    bootstrap: string;
    domain: string;
    learningStyle: string;
    errorHandling: string;
    outputFormat: string;
    timeAutomation: string;
  };
  bootstrapExists: boolean;
  missingUserFields: string[];
  identityName: string | null;
};

export type FirstRunPersonalizationApplyResult = {
  status: FirstRunPersonalizationStatus;
  writtenFiles: string[];
  removedBootstrap: boolean;
  summary: string[];
};

type NormalizedFirstRunPersonalizationAnswers = {
  [K in keyof Required<FirstRunPersonalizationAnswers>]: string;
};

type FileSystemLike = {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  unlinkSync: typeof fs.unlinkSync;
};

export type FirstRunPersonalizationServiceOptions = {
  projectRoot?: string;
  fs?: Partial<FileSystemLike>;
};

const REQUIRED_USER_FIELDS = [
  'Name',
  'What to call them',
  'Primary language',
  'Preferred tone from the agent',
  'Default response density',
  'Initiative level',
  'Candor level',
  'External action posture',
] as const;

const DEFAULT_IDENTITY = `# IDENTITY.md - Canonical Identity

## Core identity

? **Primary name:** Zavorth
? **Short name:** Zavorth
? **How you introduce yourself:** Zavorth
? **Role:** Local-first governed agent
? **Core promise:** Turn natural language into governed action without losing auditability, approval, or control

## Presence

? **Creature / metaphor:** Zavorth intelligence; watchful, exact, calm
? **Mascot:** A small fox can represent the product visually. The fox is a mascot, not a different agent name.
? **Vibe:** Serious, technical, composed, quietly warm
? **Signature:** Precise over flashy. Memorable over theatrical.
? **Emoji or mark:** Optional.
? **Avatar:** Optional.
`;

const DEFAULT_USER = `# USER.md - Human Profile

## Identity

? **Name:**
? **What to call them:**
? **Pronouns:** Optional
? **Timezone:**
? **Primary language:**

## Communication defaults

? **Preferred tone from the agent:**
? **Default response density:**
? **Formatting preferences:**
? **Dislikes:**

## Collaboration style

? **Initiative level:**
? **Candor level:**
? **How much challenge they want:**
? **External action posture:**
`;

const DEFAULT_SOUL = `# SOUL.md - Zavorth Personality

## Baseline character

You are calm, technical, exact, and quietly warm.
`;

const DEFAULT_DOMAIN = `# DOMAIN.md - Domain Specialization

## Domain profile

? **Primary domain:** general
`;

const DEFAULT_LEARNING_STYLE = `# LEARNING-STYLE.md - Learning Preferences

## Learning profile

? **Preferred learning style:** examples-first
`;

const DEFAULT_ERROR_HANDLING = `# ERROR-HANDLING.md - Error Recovery

## Error handling defaults

? **Default error handling:** ask-user
`;

const DEFAULT_OUTPUT_FORMAT = `# OUTPUT-FORMAT.md - Output Preferences

## Output formatting

? **Default output format:** answer-first-then-explain
`;

const DEFAULT_TIME_AUTOMATION = `# TIME-AUTOMATION.md - Schedule and Time

## Time preferences

? **Timezone:** UTC
? **Weekend policy:** urgent-only
`;

export class FirstRunPersonalizationService {
  private readonly projectRoot: string;
  private readonly fs: FileSystemLike;

  constructor(options: FirstRunPersonalizationServiceOptions = {}) {
    this.projectRoot = path.resolve(options.projectRoot || config.projectRoot);
    this.fs = {
      existsSync: options.fs?.existsSync || fs.existsSync.bind(fs),
      mkdirSync: options.fs?.mkdirSync || fs.mkdirSync.bind(fs),
      readFileSync: options.fs?.readFileSync || fs.readFileSync.bind(fs),
      writeFileSync: options.fs?.writeFileSync || fs.writeFileSync.bind(fs),
      unlinkSync: options.fs?.unlinkSync || fs.unlinkSync.bind(fs),
    };
  }

  public getStatus(): FirstRunPersonalizationStatus {
    const files = this.resolveFiles();
    const userContent = this.readText(files.user, DEFAULT_USER);
    const identityContent = this.readText(files.identity, DEFAULT_IDENTITY);
    const bootstrapExists = this.fs.existsSync(files.bootstrap);
    const missingUserFields = REQUIRED_USER_FIELDS.filter((field) => !this.readMarkdownField(userContent, field));
    const identityName = this.readMarkdownField(identityContent, 'Primary name');
    const reasons: string[] = [];

    if (bootstrapExists) {
      reasons.push('BOOTSTRAP.md still exists');
    }
    if (!identityName) {
      reasons.push('IDENTITY.md does not define Primary name');
    }
    if (missingUserFields.length > 0) {
      reasons.push(`USER.md has pending fields: ${missingUserFields.join(', ')}`);
    }

    return {
      pending: reasons.length > 0,
      reasons,
      files,
      bootstrapExists,
      missingUserFields,
      identityName: identityName || null,
    };
  }

  public applyAnswers(
    answers: FirstRunPersonalizationAnswers,
    options: { completeBootstrap?: boolean } = {},
  ): FirstRunPersonalizationApplyResult {
    const files = this.resolveFiles();
    const normalized = this.normalizeAnswers(answers);
    const writtenFiles: string[] = [];

    const identity = this.personalizeIdentity(
      this.readText(files.identity, DEFAULT_IDENTITY),
      normalized.agentName || this.readMarkdownField(this.readText(files.identity, DEFAULT_IDENTITY), 'Primary name') || 'Zavorth',
    );
    this.writeText(files.identity, identity);
    writtenFiles.push(files.identity);

    const user = this.personalizeUser(this.readText(files.user, DEFAULT_USER), normalized);
    this.writeText(files.user, user);
    writtenFiles.push(files.user);

    const soul = this.personalizeSoul(this.readText(files.soul, DEFAULT_SOUL), normalized);
    this.writeText(files.soul, soul);
    writtenFiles.push(files.soul);

    const domain = this.personalizeDomain(this.readText(files.domain, DEFAULT_DOMAIN), normalized);
    this.writeText(files.domain, domain);
    writtenFiles.push(files.domain);

    const learningStyle = this.personalizeLearningStyle(this.readText(files.learningStyle, DEFAULT_LEARNING_STYLE), normalized);
    this.writeText(files.learningStyle, learningStyle);
    writtenFiles.push(files.learningStyle);

    const errorHandling = this.personalizeErrorHandling(this.readText(files.errorHandling, DEFAULT_ERROR_HANDLING), normalized);
    this.writeText(files.errorHandling, errorHandling);
    writtenFiles.push(files.errorHandling);

    const outputFormat = this.personalizeOutputFormat(this.readText(files.outputFormat, DEFAULT_OUTPUT_FORMAT), normalized);
    this.writeText(files.outputFormat, outputFormat);
    writtenFiles.push(files.outputFormat);

    const timeAutomation = this.personalizeTimeAutomation(this.readText(files.timeAutomation, DEFAULT_TIME_AUTOMATION), normalized);
    this.writeText(files.timeAutomation, timeAutomation);
    writtenFiles.push(files.timeAutomation);

    let removedBootstrap = false;
    if (options.completeBootstrap && this.fs.existsSync(files.bootstrap)) {
      this.fs.unlinkSync(files.bootstrap);
      removedBootstrap = true;
    }

    // Sync agent name to wake words
    const wakeWordSync = new WakeWordSyncService();
    wakeWordSync.syncAgentNameToWakeWords(normalized.agentName).catch((err) => {
      logger.error('Failed to sync agent name to wake words:', err);
    });

    const status = this.getStatus();
    return {
      status,
      writtenFiles,
      removedBootstrap,
      summary: this.buildSummary(normalized, removedBootstrap),
    };
  }

  private resolveFiles(): FirstRunPersonalizationStatus['files'] {
    return {
      identity: path.join(this.projectRoot, 'IDENTITY.md'),
      soul: path.join(this.projectRoot, 'SOUL.md'),
      user: path.join(this.projectRoot, 'USER.md'),
      bootstrap: path.join(this.projectRoot, 'BOOTSTRAP.md'),
      domain: path.join(this.projectRoot, 'DOMAIN.md'),
      learningStyle: path.join(this.projectRoot, 'LEARNING-STYLE.md'),
      errorHandling: path.join(this.projectRoot, 'ERROR-HANDLING.md'),
      outputFormat: path.join(this.projectRoot, 'OUTPUT-FORMAT.md'),
      timeAutomation: path.join(this.projectRoot, 'TIME-AUTOMATION.md'),
    };
  }

  private normalizeAnswers(answers: FirstRunPersonalizationAnswers): NormalizedFirstRunPersonalizationAnswers {
    const preferredAddress = this.clean(answers.preferredAddress) || this.clean(answers.userName) || 'user';
    return {
      agentName: this.clean(answers.agentName) || 'Zavorth',
      userName: this.clean(answers.userName) || preferredAddress,
      preferredAddress,
      primaryLanguage: this.clean(answers.primaryLanguage) || 'en-US',
      preferredTone: this.clean(answers.preferredTone) || 'sober, warm, direct',
      responseDensity: this.clean(answers.responseDensity) || 'balanced',
      initiativeLevel: this.clean(answers.initiativeLevel) || 'proactive internally; ask before risky action',
      candorLevel: this.clean(answers.candorLevel) || 'honest and respectful',
      challengePreference: this.clean(answers.challengePreference) || 'call out weak ideas early',
      externalActionPosture: this.clean(answers.externalActionPosture) || 'ask before public or irreversible action',
      domain: this.clean(answers.domain) || 'general',
      learningStyle: this.clean(answers.learningStyle) || 'examples-first',
      errorHandlingDefault: this.clean(answers.errorHandlingDefault) || 'ask-user',
      outputFormatDefault: this.clean(answers.outputFormatDefault) || 'answer-first-then-explain',
      weekendPolicy: this.clean(answers.weekendPolicy) || 'urgent-only',
      timezone: this.clean(answers.timezone) || 'UTC',
    };
  }

  private personalizeIdentity(content: string, agentName: string): string {
    let result = content || DEFAULT_IDENTITY;
    result = this.upsertMarkdownField(result, 'Primary name', agentName);
    result = this.upsertMarkdownField(result, 'Short name', agentName);
    result = this.upsertMarkdownField(result, 'How you introduce yourself', agentName);
    return this.ensureTrailingNewline(result);
  }

  private personalizeUser(
    content: string,
    answers: NormalizedFirstRunPersonalizationAnswers,
  ): string {
    let result = content || DEFAULT_USER;
    result = this.upsertMarkdownField(result, 'Name', answers.userName);
    result = this.upsertMarkdownField(result, 'What to call them', answers.preferredAddress);
    result = this.upsertMarkdownField(result, 'Primary language', answers.primaryLanguage);
    result = this.upsertMarkdownField(result, 'Preferred tone from the agent', answers.preferredTone);
    result = this.upsertMarkdownField(result, 'Default response density', answers.responseDensity);
    result = this.upsertMarkdownField(result, 'Initiative level', answers.initiativeLevel);
    result = this.upsertMarkdownField(result, 'Candor level', answers.candorLevel);
    result = this.upsertMarkdownField(result, 'How much challenge they want', answers.challengePreference);
    result = this.upsertMarkdownField(result, 'External action posture', answers.externalActionPosture);
    return this.ensureTrailingNewline(result);
  }

  private personalizeSoul(
    content: string,
    answers: NormalizedFirstRunPersonalizationAnswers,
  ): string {
    const section = [
      '## User Calibration',
      '',
      `- **Preferred tone:** ${answers.preferredTone}`,
      `- **Response density:** ${answers.responseDensity}`,
      `- **Initiative:** ${answers.initiativeLevel}`,
      `- **Candor:** ${answers.candorLevel}`,
      `- **Challenge:** ${answers.challengePreference}`,
      `- **External action posture:** ${answers.externalActionPosture}`,
      `- **Primary language:** ${answers.primaryLanguage}`,
      '',
      'This section is written by first-run personalization and should be updated when the user recalibrates the relationship.',
    ].join('\n');
    return this.ensureTrailingNewline(this.upsertSection(content || DEFAULT_SOUL, 'User Calibration', section));
  }

  private personalizeDomain(
    content: string,
    answers: NormalizedFirstRunPersonalizationAnswers,
  ): string {
    let result = content || DEFAULT_DOMAIN;
    result = this.upsertMarkdownField(result, 'Primary domain', answers.domain);
    return this.ensureTrailingNewline(result);
  }

  private personalizeLearningStyle(
    content: string,
    answers: NormalizedFirstRunPersonalizationAnswers,
  ): string {
    let result = content || DEFAULT_LEARNING_STYLE;
    result = this.upsertMarkdownField(result, 'Preferred learning style', answers.learningStyle);
    return this.ensureTrailingNewline(result);
  }

  private personalizeErrorHandling(
    content: string,
    answers: NormalizedFirstRunPersonalizationAnswers,
  ): string {
    let result = content || DEFAULT_ERROR_HANDLING;
    result = this.upsertMarkdownField(result, 'Default error handling', answers.errorHandlingDefault);
    return this.ensureTrailingNewline(result);
  }

  private personalizeOutputFormat(
    content: string,
    answers: NormalizedFirstRunPersonalizationAnswers,
  ): string {
    let result = content || DEFAULT_OUTPUT_FORMAT;
    result = this.upsertMarkdownField(result, 'Default output format', answers.outputFormatDefault);
    return this.ensureTrailingNewline(result);
  }

  private personalizeTimeAutomation(
    content: string,
    answers: NormalizedFirstRunPersonalizationAnswers,
  ): string {
    let result = content || DEFAULT_TIME_AUTOMATION;
    result = this.upsertMarkdownField(result, 'Timezone', answers.timezone);
    result = this.upsertMarkdownField(result, 'Weekend policy', answers.weekendPolicy);
    return this.ensureTrailingNewline(result);
  }

  private buildSummary(
    answers: NormalizedFirstRunPersonalizationAnswers,
    removedBootstrap: boolean,
  ): string[] {
    return [
      `Agent: ${answers.agentName}`,
      `User: ${answers.preferredAddress}`,
      `Language: ${answers.primaryLanguage}`,
      `Tone: ${answers.preferredTone}`,
      `Density: ${answers.responseDensity}`,
      `Initiative: ${answers.initiativeLevel}`,
      `Domain: ${answers.domain}`,
      `Learning: ${answers.learningStyle}`,
      `Timezone: ${answers.timezone}`,
      `Bootstrap: ${removedBootstrap ? 'completed' : 'retained for review'}`,
    ];
  }

  private upsertMarkdownField(content: string, label: string, value: string): string {
    const escaped = escapeRegExp(label);
    const pattern = new RegExp(`(^[ \\t]*-[ \\t]+\\*\\*${escaped}:\\*\\*)[ \\t]*(.*)$`, 'm');
    if (pattern.test(content)) {
      return content.replace(pattern, `$1 ${value}`);
    }
    const lines = content.trimEnd().split(/\r...\n/);
    lines.push(`- **${label}:** ${value}`);
    return lines.join('\n');
  }

  private upsertSection(content: string, title: string, section: string): string {
    const escaped = escapeRegExp(title);
    const pattern = new RegExp(`(^##\\s+${escaped}\\s*$)[\\s\\S]*...(...=^##\\s+|\\s*$)`, 'm');
    if (pattern.test(content)) {
      return content.replace(pattern, section);
    }
    return `${content.trimEnd()}\n\n${section}`;
  }

  private readMarkdownField(content: string, label: string): string {
    const escaped = escapeRegExp(label);
    const match = content.match(new RegExp(`^[ \\t]*-[ \\t]+\\*\\*${escaped}:\\*\\*[ \\t]*(.*)$`, 'm'));
    const value = String(match?.[1] || '').trim();
    if (!value || value.toLowerCase() === 'optional') {
      return '';
    }
    return value;
  }

  private readText(filePath: string, fallback: string): string {
    try {
      if (!this.fs.existsSync(filePath)) {
        return fallback;
      }
      return String(this.fs.readFileSync(filePath, 'utf8') || '');
    } catch (error: unknown) {logger.warn('[First Run Personalization] filesystem operation failed', error); return fallback; }
  }

  private writeText(filePath: string, content: string): void {
    this.fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.fs.writeFileSync(filePath, this.ensureTrailingNewline(content), 'utf8');
  }

  private clean(value: string | null | undefined): string {
    return String(value || '').replace(/\r...\n/g, ' ').trim();
  }

  private ensureTrailingNewline(content: string): string {
    return `${content.trimEnd()}\n`;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+...^${}()|[\]\\]/g, '\\$&');
}
