/**
 * ProfileOnboarding — Defines what questions to ask per experience profile.
 *
 * Each profile gets a tailored onboarding flow:
 * - personal: 3 questions (provider, API key, language)
 * - creator: 4 questions (+ content style)
 * - developer: 5 questions (+ stack, tools)
 * - business: 6 questions (+ team, compliance)
 * - power: 2 questions (provider, API key — assumes advanced user)
 */

import type { ZavorthExperienceProfileId } from '../contracts/ui/ZavorthExperienceProfileContract.js';

export interface OnboardingQuestion {
  id: string;
  type: 'text' | 'select' | 'confirm' | 'multiselect';
  message: string;
  options?: Array<{ value: string; label: string; hint?: string }>;
  required: boolean;
  defaultValue?: string;
}

export interface ProfileOnboardingFlow {
  profileId: ZavorthExperienceProfileId;
  description: string;
  questions: OnboardingQuestion[];
}

const PROFILE_ONBOARDING_FLOWS: Record<ZavorthExperienceProfileId, ProfileOnboardingFlow> = {
  personal: {
    profileId: 'personal',
    description: 'Minimal setup: provider, API key, and language. Start in under 30 seconds.',
    questions: [
      {
        id: 'provider',
        type: 'select',
        message: 'Which AI provider do you want to use?',
        options: [
          { value: 'openai', label: 'OpenAI', hint: 'GPT-4o, GPT-4' },
          { value: 'anthropic', label: 'Anthropic', hint: 'Claude' },
          { value: 'google', label: 'Google', hint: 'Gemini' },
        ],
        required: true,
      },
      {
        id: 'apiKey',
        type: 'text',
        message: 'Paste your API key:',
        required: true,
      },
      {
        id: 'language',
        type: 'select',
        message: 'Preferred language?',
        options: [
          { value: 'pt-BR', label: 'Portuguese (Brazil)' },
          { value: 'en', label: 'English' },
          { value: 'es', label: 'Spanish' },
        ],
        required: true,
        defaultValue: 'pt-BR',
      },
    ],
  },
  creator: {
    profileId: 'creator',
    description: 'Setup for content creation: provider, style, and research tools.',
    questions: [
      {
        id: 'provider',
        type: 'select',
        message: 'Which AI provider?',
        options: [
          { value: 'openai', label: 'OpenAI', hint: 'GPT-4o' },
          { value: 'anthropic', label: 'Anthropic', hint: 'Claude' },
        ],
        required: true,
      },
      {
        id: 'apiKey',
        type: 'text',
        message: 'API key:',
        required: true,
      },
      {
        id: 'contentStyle',
        type: 'select',
        message: 'Default content style?',
        options: [
          { value: 'casual', label: 'Casual', hint: 'friendly, approachable' },
          { value: 'professional', label: 'Professional', hint: 'business-like' },
          { value: 'technical', label: 'Technical', hint: 'precise, detailed' },
        ],
        required: true,
        defaultValue: 'casual',
      },
      {
        id: 'language',
        type: 'select',
        message: 'Language?',
        options: [
          { value: 'pt-BR', label: 'Portuguese' },
          { value: 'en', label: 'English' },
        ],
        required: true,
        defaultValue: 'pt-BR',
      },
    ],
  },
  developer: {
    profileId: 'developer',
    description: 'Setup for coding: provider, stack, and dev tools.',
    questions: [
      {
        id: 'provider',
        type: 'select',
        message: 'AI provider?',
        options: [
          { value: 'openai', label: 'OpenAI' },
          { value: 'anthropic', label: 'Anthropic' },
          { value: 'google', label: 'Google Gemini' },
        ],
        required: true,
      },
      {
        id: 'apiKey',
        type: 'text',
        message: 'API key:',
        required: true,
      },
      {
        id: 'primaryStack',
        type: 'select',
        message: 'Primary tech stack?',
        options: [
          { value: 'typescript', label: 'TypeScript / Node.js' },
          { value: 'python', label: 'Python' },
          { value: 'rust', label: 'Rust' },
          { value: 'go', label: 'Go' },
          { value: 'other', label: 'Other' },
        ],
        required: true,
      },
      {
        id: 'devTools',
        type: 'multiselect',
        message: 'Favorite dev tools? (select all that apply)',
        options: [
          { value: 'jest', label: 'Jest' },
          { value: 'vitest', label: 'Vitest' },
          { value: 'eslint', label: 'ESLint' },
          { value: 'prettier', label: 'Prettier' },
          { value: 'docker', label: 'Docker' },
          { value: 'git', label: 'Git' },
        ],
        required: false,
        defaultValue: 'jest,eslint,git',
      },
      {
        id: 'language',
        type: 'select',
        message: 'Language?',
        options: [
          { value: 'pt-BR', label: 'Portuguese' },
          { value: 'en', label: 'English' },
        ],
        required: true,
        defaultValue: 'pt-BR',
      },
    ],
  },
  business: {
    profileId: 'business',
    description: 'Setup for teams: provider, compliance, and audit preferences.',
    questions: [
      {
        id: 'provider',
        type: 'select',
        message: 'AI provider?',
        options: [
          { value: 'openai', label: 'OpenAI' },
          { value: 'anthropic', label: 'Anthropic' },
        ],
        required: true,
      },
      {
        id: 'apiKey',
        type: 'text',
        message: 'API key:',
        required: true,
      },
      {
        id: 'teamSize',
        type: 'select',
        message: 'Team size?',
        options: [
          { value: 'solo', label: 'Just me' },
          { value: 'small', label: '2-5 people' },
          { value: 'medium', label: '6-20 people' },
          { value: 'large', label: '20+ people' },
        ],
        required: true,
      },
      {
        id: 'complianceLevel',
        type: 'select',
        message: 'Compliance requirements?',
        options: [
          { value: 'standard', label: 'Standard', hint: 'basic audit trails' },
          { value: 'strict', label: 'Strict', hint: 'full receipts, approval gates' },
          { value: 'regulated', label: 'Regulated', hint: 'HIPAA, SOC2, GDPR' },
        ],
        required: true,
        defaultValue: 'standard',
      },
      {
        id: 'auditTrail',
        type: 'confirm',
        message: 'Enable full audit trail for all actions?',
        required: true,
        defaultValue: 'true',
      },
      {
        id: 'language',
        type: 'select',
        message: 'Language?',
        options: [
          { value: 'pt-BR', label: 'Portuguese' },
          { value: 'en', label: 'English' },
        ],
        required: true,
        defaultValue: 'pt-BR',
      },
    ],
  },
  power: {
    profileId: 'power',
    description: 'Minimal setup for advanced users. Configure everything else manually.',
    questions: [
      {
        id: 'provider',
        type: 'select',
        message: 'AI provider?',
        options: [
          { value: 'openai', label: 'OpenAI' },
          { value: 'anthropic', label: 'Anthropic' },
          { value: 'google', label: 'Google Gemini' },
          { value: 'local', label: 'Local (Ollama, LMStudio)' },
        ],
        required: true,
      },
      {
        id: 'apiKey',
        type: 'text',
        message: 'API key (or press Enter for local):',
        required: false,
      },
    ],
  },
};

export class ProfileOnboardingService {
  /**
   * Returns the onboarding flow for a given profile.
   */
  getFlow(profileId: ZavorthExperienceProfileId): ProfileOnboardingFlow {
    return PROFILE_ONBOARDING_FLOWS[profileId];
  }

  /**
   * Returns all onboarding flows.
   */
  getAllFlows(): ProfileOnboardingFlow[] {
    return Object.values(PROFILE_ONBOARDING_FLOWS);
  }

  /**
   * Returns the question count for a profile (for display).
   */
  getQuestionCount(profileId: ZavorthExperienceProfileId): number {
    return PROFILE_ONBOARDING_FLOWS[profileId].questions.length;
  }

  /**
   * Returns a summary of all profiles' question counts.
   */
  getSummary(): Array<{
    profileId: ZavorthExperienceProfileId;
    questions: number;
    description: string;
  }> {
    return Object.values(PROFILE_ONBOARDING_FLOWS).map((flow) => ({
      profileId: flow.profileId,
      questions: flow.questions.length,
      description: flow.description,
    }));
  }
}
