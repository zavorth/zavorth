import fs from 'fs';
import path from 'path';
import { logger } from '../logger.js';

export type DialecticQuestionCategory =
  | 'communication_style'
  | 'work_preferences'
  | 'domain_expertise'
  | 'tool_preferences'
  | 'schedule'
  | 'personality';

export type DialecticQuestion = {
  id: string;
  category: DialecticQuestionCategory;
  question: string;
  followUp?: string;
  options?: string[];
  priority: number;
  askedCount: number;
  lastAskedAt: string | null;
  answeredAt: string | null;
  answer: string | null;
};

export type DialecticProfile = {
  contractVersion: string;
  generatedAt: string;
  questions: DialecticQuestion[];
  userTraits: Record<string, string>;
  confidence: number;
  totalAsked: number;
  totalAnswered: number;
};

export type DialecticRuntime = {
  homeRoot?: string;
  now?: () => Date;
};

const DEFAULT_QUESTIONS: Omit<DialecticQuestion, 'askedCount' | 'lastAskedAt' | 'answeredAt' | 'answer'>[] = [
  { id: 'comm_tone', category: 'communication_style', question: 'How do you prefer I respond... Direct and short, or more detailed...', options: ['Direct and short', 'Detailed with examples', 'Depends on context'], priority: 1 },
  { id: 'comm_language', category: 'communication_style', question: 'Which language do you prefer for our conversations...', options: ['Portuguese', 'English', 'Mixed'], priority: 1 },
  { id: 'work_initiative', category: 'work_preferences', question: 'How much initiative do you want me to take... Should I act or wait for confirmation...', options: ['Act and report', 'Ask first', 'Only when requested'], priority: 2 },
  { id: 'work_hours', category: 'schedule', question: 'What are your work hours... Should I avoid disturbing you during any period...', options: ['8am-6pm', 'Flexible', 'Night (8pm-2am)', 'Early morning (6am-10am)'], priority: 2 },
  { id: 'domain_main', category: 'domain_expertise', question: 'What is your main work area... This helps me adapt vocabulary and tools.', options: ['Software Engineering', 'Project Management', 'Design', 'Marketing', 'Data/AI', 'Other'], priority: 3 },
  { id: 'tool_code_review', category: 'tool_preferences', question: 'When I review code, what should I focus on...', options: ['Security first', 'Performance', 'Readability', 'All equally'], priority: 3 },
  { id: 'personality_challenge', category: 'personality', question: 'Do you want me to challenge your ideas when I find them weak, or be more discreet...', options: ['Challenge directly', 'Discreet but honest', 'Only when asked'], priority: 2 },
  { id: 'work_deep_work', category: 'work_preferences', question: 'Do you have "deep work" periods where you don\'t want interruptions...', options: ['Yes, mornings', 'Yes, afternoons', 'No fixed routine'], priority: 2 },
  { id: 'domain_tools', category: 'tool_preferences', question: 'Which tools do you use most often...', options: ['VS Code', 'Terminal', 'Browser', 'JetBrains', 'Figma', 'Other'], priority: 3 },
  { id: 'comm_candor', category: 'personality', question: 'How much candor do you want... Should I be 100% honest or soften when needed...', options: ['100% honest', 'Honest but polite', 'Soften when possible'], priority: 1 },
  { id: 'work_morning', category: 'schedule', question: 'What do you do first when starting your day... This helps me prioritize.', options: ['Check emails', 'Code review', 'Plan tasks', 'Something else'], priority: 3 },
  { id: 'personality_humor', category: 'personality', question: 'Do you appreciate a touch of humor in responses, or prefer serious...', options: ['Light humor ok', 'Always serious', 'Depends on context'], priority: 2 },
  { id: 'domain_learning', category: 'domain_expertise', question: 'How do you prefer to learn new things...', options: ['Practical examples', 'Theory first', 'Direct hands-on', 'Videos/documentation'], priority: 3 },
  { id: 'work_feedback', category: 'work_preferences', question: 'When I make a mistake, how do you prefer I react...', options: ['Fix silently', 'Explain the error and fix', 'Ask before fixing'], priority: 2 },
  { id: 'tool_browser', category: 'tool_preferences', question: 'Should I use browser automation when needed, or avoid it...', options: ['Use when needed', 'Avoid, I prefer manual', 'Only with my authorization'], priority: 3 },
];

const PROFILE_FILE = 'data/runtime/user-dialectic-profile.json';

export class UserModelDialecticService {
  private readonly homeRoot: string;
  private readonly now: () => Date;
  private profile: DialecticProfile;

  constructor(runtime: DialecticRuntime = {}) {
    this.homeRoot = runtime.homeRoot || process.cwd();
    this.now = runtime.now || (() => new Date());
    this.profile = this.loadProfile();
  }

  getNextQuestion(): DialecticQuestion | null {
    const unanswered = this.profile.questions
      .filter((q) => !q.answer)
      .sort((a, b) => a.priority - b.priority || a.askedCount - b.askedCount);

    return unanswered[0] || null;
  }

  recordAnswer(questionId: string, answer: string): void {
    const question = this.profile.questions.find((q) => q.id === questionId);
    if (!question) return;

    question.answer = answer;
    question.answeredAt = this.now().toISOString();
    question.askedCount++;

    this.profile.userTraits[question.category] = answer;
    this.profile.totalAnswered = this.profile.questions.filter((q) => q.answer).length;
    this.profile.totalAsked = this.profile.questions.filter((q) => q.askedCount > 0).length;
    this.profile.confidence = this.profile.totalAnswered / this.profile.questions.length;
    this.profile.generatedAt = this.now().toISOString();

    this.saveProfile();
  }

  recordTrait(category: DialecticQuestionCategory, observation: string): void {
    this.profile.userTraits[category] = observation;
    this.profile.generatedAt = this.now().toISOString();
    this.saveProfile();
  }

  markAsked(questionId: string): void {
    const question = this.profile.questions.find((q) => q.id === questionId);
    if (!question) return;

    question.askedCount++;
    question.lastAskedAt = this.now().toISOString();
    this.profile.generatedAt = this.now().toISOString();
    this.saveProfile();
  }

  getTrait(category: DialecticQuestionCategory): string | null {
    return this.profile.userTraits[category] || null;
  }

  getProfile(): DialecticProfile {
    return { ...this.profile };
  }

  getProgress(): { asked: number; answered: number; total: number; confidence: number } {
    return {
      asked: this.profile.totalAsked,
      answered: this.profile.totalAnswered,
      total: this.profile.questions.length,
      confidence: this.profile.confidence,
    };
  }

  getAnsweredQuestions(): DialecticQuestion[] {
    return this.profile.questions.filter((q) => q.answer);
  }

  getUnansweredQuestions(): DialecticQuestion[] {
    return this.profile.questions.filter((q) => !q.answer);
  }

  resetProfile(): void {
    this.profile = this.buildDefaultProfile();
    this.saveProfile();
  }

  private buildDefaultProfile(): DialecticProfile {
    return {
      contractVersion: 'zavorth-user-dialectic/1',
      generatedAt: this.now().toISOString(),
      questions: DEFAULT_QUESTIONS.map((q) => ({
        ...q,
        askedCount: 0,
        lastAskedAt: null,
        answeredAt: null,
        answer: null,
      })),
      userTraits: {},
      confidence: 0,
      totalAsked: 0,
      totalAnswered: 0,
    };
  }

  private loadProfile(): DialecticProfile {
    const fp = this.getProfilePath();
    if (fs.existsSync(fp)) {
      try {
        const data = JSON.parse(fs.readFileSync(fp, 'utf-8'));
        if (data && data.contractVersion) return data;
      } catch (error: unknown) {// fall through
      logger.warn('[User Model Dialectic] JSON parse failed', error);
    }
    }
    return this.buildDefaultProfile();
  }

  private saveProfile(): void {
    const fp = this.getProfilePath();
    const dir = path.dirname(fp);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(this.profile, null, 2), 'utf-8');
  }

  private getProfilePath(): string {
    return path.join(this.homeRoot, PROFILE_FILE);
  }
}
