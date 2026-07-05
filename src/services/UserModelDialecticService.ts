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
  { id: 'comm_tone', category: 'communication_style', question: 'Como você prefere que eu te responda? Direto e curto, ou mais detalhado?', options: ['Direto e curto', 'Detalhado com exemplos', 'Depende do contexto'], priority: 1 },
  { id: 'comm_language', category: 'communication_style', question: 'Qual idioma você prefere para nossas conversas?', options: ['Português', 'Inglês', 'Misto'], priority: 1 },
  { id: 'work_initiative', category: 'work_preferences', question: 'Quanto de iniciativa você quer que eu tome? Devo agir ou esperar confirmação?', options: ['Agir e reportar', 'Perguntar antes', 'Só quando pedido'], priority: 2 },
  { id: 'work_hours', category: 'schedule', question: 'Quais são suas horais de trabalho? Devo evitar te perturbar em algum período?', options: ['8h-18h', 'Flexible', 'Noite (20h-2h)', 'Manhã cedo (6h-10h)'], priority: 2 },
  { id: 'domain_main', category: 'domain_expertise', question: 'Qual sua área principal de trabalho? Isso ajuda eu a adaptar vocabulário e ferramentas.', options: ['Engenharia de Software', 'Gestão de Projetos', 'Design', 'Marketing', 'Dados/IA', 'Outra'], priority: 3 },
  { id: 'tool_code_review', category: 'tool_preferences', question: 'Quando eu revisar código, devo focar em quê?', options: ['Segurança primeiro', 'Performance', 'Legibilidade', 'Tudo igualmente'], priority: 3 },
  { id: 'personality_challenge', category: 'personality', question: 'Quer que eu desafie suas ideias quando achar fraca, ou ser mais discreto?', options: ['Desafie direto', 'Discreto mas honesto', 'Só quando pedir'], priority: 2 },
  { id: 'work_deep_work', category: 'work_preferences', question: 'Você tem períodos de "deep work" onde não quer interrupções?', options: ['Sim, manhãs', 'Sim, tardes', 'Não tenho rotina fixa'], priority: 2 },
  { id: 'domain_tools', category: 'tool_preferences', question: 'Quais ferramentas você mais usa no dia a dia?', options: ['VS Code', 'Terminal', 'Browser', 'JetBrains', 'Figma', 'Outra'], priority: 3 },
  { id: 'comm_candor', category: 'personality', question: 'Quanto de franqueza você quer? Devo ser 100% honesto ou suavizar quando necessário?', options: ['100% honesto', 'Honesto mas educado', 'Suavizar quando possível'], priority: 1 },
  { id: 'work_morning', category: 'schedule', question: 'O que você faz primeiro ao começar o dia? Isso ajuda eu a priorizar.', options: ['Checar emails', 'Review de código', 'Planejar tarefas', 'Outra coisa'], priority: 3 },
  { id: 'personality_humor', category: 'personality', question: 'Você aprecia um toque de humor nas respostas, ou prefere sério?', options: ['Humor leve ok', 'Sério sempre', 'Depende do contexto'], priority: 2 },
  { id: 'domain_learning', category: 'domain_expertise', question: 'Como você prefere aprender coisas novas?', options: ['Exemplos práticos', 'Teoria primeiro', 'Hands-on direto', 'Vídeos/documentação'], priority: 3 },
  { id: 'work_feedback', category: 'work_preferences', question: 'Quando eu cometer um erro, como você prefere que eu reaja?', options: ['Corrija silenciosamente', 'Explique o erro e corrija', 'Pergunte antes de corrigir'], priority: 2 },
  { id: 'tool_browser', category: 'tool_preferences', question: 'Devo usar automação de browser quando necessário, ou evitar?', options: ['Use quando precisar', 'Evite, prefiro manual', 'Só com minha autorização'], priority: 3 },
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
      } catch (error) { // fall through logger.warn('[User Model Dialectic] JSON parse failed', error); }
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
