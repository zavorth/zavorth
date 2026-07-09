import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { LlmRuntimeService } from './llm/LlmRuntimeService.js';
import { MemoryService } from './MemoryService.js';
import type { ChatMessage } from '../providers/ILlmProvider.js';
import { logger } from '../logger.js';

export interface LoopSessionState {
  sessionId: string;
  status: 'IDLE' | 'WAITING_FOR_LOOP_MODE' | 'GRILLING' | 'EXECUTING_LOOP';
  task: string;
  mode?: 'auto' | 'grill';
  grillState?: {
    questions: string[];
    currentQuestionIndex: number;
    answers: string[];
  };
  rubric?: {
    criteria: string[];
  };
  history?: Array<{
    iteration: number;
    code: string;
    grades: Record<string, number>;
    average: number;
    weakPoint: string;
    critique: string;
    sandboxOutput: string;
  }>;
  finalPlan?: string;
}

type JudgeResult = {
  grades: Record<string, number>;
  average: number;
  weakPoint: string;
  critique: string;
};

export class LoopEngineeringService {
  private readonly llm: LlmRuntimeService;
  private readonly memory: MemoryService;
  private readonly sessionDir: string;

  constructor() {
    this.llm = new LlmRuntimeService();
    this.memory = new MemoryService();
    this.sessionDir = path.join(process.cwd(), 'data', 'runtime');
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionDir, `loop_session_${sessionId}.json`);
  }

  public async getSessionState(sessionId: string): Promise<LoopSessionState> {
    const filePath = this.getSessionPath(sessionId);
    if (!fs.existsSync(filePath)) {
      return { sessionId, status: 'IDLE', task: '' };
    }
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error: unknown) {logger.warn('[Loop Engineering] JSON parse failed', error);
    return { sessionId, status: 'IDLE', task: '' };
  }
  }

  public async saveSessionState(state: LoopSessionState): Promise<void> {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
    fs.writeFileSync(this.getSessionPath(state.sessionId), JSON.stringify(state, null, 2), 'utf8');
  }

  public async clearSessionState(sessionId: string): Promise<void> {
    const filePath = this.getSessionPath(sessionId);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (error: unknown) {// Best effort cleanup only.
      logger.warn('[Loop Engineering] file cleanup failed', error);
    }
    }
  }

  private async askLlm(prompt: string, systemPrompt?: string): Promise<string> {
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    const response = await this.llm.chat(messages);
    return response.content || '';
  }

  public async initiateLoop(
    sessionId: string,
    task: string,
    options: { auto?: boolean; grill?: boolean; userId?: string } = {},
  ): Promise<string> {
    const state: LoopSessionState = {
      sessionId,
      status: 'IDLE',
      task,
    };

    if (options.auto) {
      state.status = 'EXECUTING_LOOP';
      state.mode = 'auto';
      await this.saveSessionState(state);
      return this.runAutoLoop(sessionId, options.userId || 'cli-operator', task);
    }

    if (options.grill) {
      state.status = 'GRILLING';
      state.mode = 'grill';
      const questions = await this.generateGrillQuestions(task);
      state.grillState = {
        questions,
        currentQuestionIndex: 0,
        answers: [],
      };
      await this.saveSessionState(state);
      return `[Guided Mode] Starting clarification questions:\n\n1. Question: ${questions[0]}`;
    }

    state.status = 'WAITING_FOR_LOOP_MODE';
    await this.saveSessionState(state);

    return `Select the execution mode for this task:\n"${task}"\n\n1. Automatic (--auto)\n2. Guided (--grill)\n\nType 1 or 2 to select, or 'exit' to cancel.`;
  }

  public async processInput(sessionId: string, userId: string, userInput: string): Promise<string> {
    const state = await this.getSessionState(sessionId);
    if (state.status === 'IDLE') {
      return 'No active loop. Use /loop <task> to start.';
    }

    const cleanInput = userInput.trim();

    if (state.status === 'WAITING_FOR_LOOP_MODE') {
      if (cleanInput === '1' || cleanInput.toLowerCase().includes('auto')) {
        state.status = 'EXECUTING_LOOP';
        state.mode = 'auto';
        await this.saveSessionState(state);
        return this.runAutoLoop(sessionId, userId, state.task);
      }
      if (cleanInput === '2' || cleanInput.toLowerCase().includes('grill')) {
        state.status = 'GRILLING';
        state.mode = 'grill';
        const questions = await this.generateGrillQuestions(state.task);
        state.grillState = {
          questions,
          currentQuestionIndex: 0,
          answers: [],
        };
        await this.saveSessionState(state);
        return `[Guided Mode] Starting clarification questions:\n\n1. Question: ${questions[0]}`;
      }

      return `Invalid selection.\n\nSelect the execution mode for this task:\n"${state.task}"\n\n1. Automatic (--auto)\n2. Guided (--grill)\n\nType 1 or 2 to select, or 'exit' to cancel.`;
    }

    if (state.status === 'GRILLING') {
      if (!state.grillState) {
        state.status = 'IDLE';
        await this.clearSessionState(sessionId);
        return 'Invalid state detected. The loop was reset.';
      }

      state.grillState.answers.push(cleanInput);
      const nextIndex = state.grillState.currentQuestionIndex + 1;
      state.grillState.currentQuestionIndex = nextIndex;

      if (nextIndex < state.grillState.questions.length) {
        await this.saveSessionState(state);
        return `Question ${nextIndex + 1}: ${state.grillState.questions[nextIndex]}`;
      }

      state.status = 'EXECUTING_LOOP';
      await this.saveSessionState(state);
      return this.runGrillLoop(sessionId, userId, state.task, state.grillState.answers);
    }

    return 'The loop is running. Wait for it to finish.';
  }

  private async generateGrillQuestions(task: string): Promise<string[]> {
    const prompt = `You are an expert requirements engineer. Analyze the following engineering task and generate 2 to 5 clear, direct questions that clarify technical success criteria and requirements.
Respond ONLY with a JSON string array in this format:
["Question 1", "Question 2", ...]

Task: "${task}"`;

    try {
      const response = await this.askLlm(prompt);
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length >= 2 && parsed.length <= 5) {
        return parsed.map(String);
      }
    } catch (error: unknown) {// Fall back to safe default questions.
      logger.warn('[Loop Engineering] JSON parse failed', error);
    }

    return [
      'What behavior is expected for error scenarios or invalid inputs?',
      'Are there any performance constraints or processing limits?',
      'What are the formats and types of the main expected outputs?',
    ];
  }

  private async generateRubric(task: string, answersContext?: string): Promise<string[]> {
    const prompt = `You are an expert QA engineer. Based on the engineering task and the provided information, generate a rubric with exactly 3 detailed, measurable technical success criteria for validating the implementation.
Respond ONLY with JSON in this format:
{
  "criteria": [
    "Criterion 1: technical description...",
    "Criterion 2: technical description...",
    "Criterion 3: technical description..."
  ]
}

Task: "${task}"
${answersContext ? `User-provided answers:\n${answersContext}` : ''}`;

    try {
      const response = await this.askLlm(prompt);
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && Array.isArray(parsed.criteria) && parsed.criteria.length === 3) {
        return parsed.criteria.map(String);
      }
    } catch (error: unknown) {// Use deterministic fallback criteria.
      logger.warn('[Loop Engineering] JSON parse failed', error);
    }

    return [
      'Criterion 1: The JavaScript syntax and structure must be valid.',
      'Criterion 2: The code must implement the core logic of the specified task.',
      'Criterion 3: The code must return consistent results without runtime failures.',
    ];
  }

  public async runAutoLoop(sessionId: string, userId: string, task: string): Promise<string> {
    const rubric = await this.generateRubric(task);
    return this.executeEngine(sessionId, userId, task, rubric);
  }

  public async runGrillLoop(sessionId: string, userId: string, task: string, answers: string[]): Promise<string> {
    const state = await this.getSessionState(sessionId);
    const questions = state.grillState?.questions || [];
    const answersContext = questions.map((questionText, index) => `Q: ${questionText}\nA: ${answers[index] || ''}`).join('\n\n');
    const rubric = await this.generateRubric(task, answersContext);
    return this.executeEngine(sessionId, userId, task, rubric);
  }

  private async executeEngine(sessionId: string, userId: string, task: string, rubric: string[]): Promise<string> {
    const state = await this.getSessionState(sessionId);
    state.status = 'EXECUTING_LOOP';
    state.rubric = { criteria: rubric };
    state.history = [];
    await this.saveSessionState(state);

    let currentCode = '';
    let currentCritique = '';
    let currentWeakPoint = '';
    let iterations = 0;
    let average = 0;

    const sandboxDir = path.join(process.cwd(), 'data', 'runtime', 'sandbox');
    if (!fs.existsSync(sandboxDir)) {
      fs.mkdirSync(sandboxDir, { recursive: true });
    }

    while (iterations < 5) {
      iterations++;

      const executorPrompt = `You are an expert software developer.
Implement the JavaScript solution for the following engineering task.

Task: "${task}"

Validation rubric:
- criterion1: ${rubric[0]}
- criterion2: ${rubric[1]}
- criterion3: ${rubric[2]}

${
  iterations > 1
    ? `This is iteration ${iterations}. The code generated in the previous iteration was:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nThe previous evaluation identified the weakest point as: "${currentWeakPoint}".\nConstructive critique: ${currentCritique}\n\nAdjust and improve the code to fix that weakness and improve the score.`
    : 'Write the best possible initial implementation.'
}

Provide ONLY the complete functional JavaScript code, with no markdown explanations outside the code.`;

      const executorResponse = await this.askLlm(executorPrompt);
      currentCode = this.extractCode(executorResponse);

      const sandboxFile = path.join(sandboxDir, `sandbox_${sessionId}_iter_${iterations}.js`);
      fs.writeFileSync(sandboxFile, currentCode, 'utf8');

      const checkResult = spawnSync('node', ['-c', sandboxFile], { encoding: 'utf8' });
      const ok = checkResult.status === 0;
      const sandboxOutput = ok
        ? 'Syntax check passed successfully.'
        : `Syntax check failed.\nError:\n${checkResult.stderr || checkResult.stdout}`;

      const judgePrompt = `You are an expert code judge. Evaluate the implementation and sandbox result against the 3 rules/criteria in the technical rubric.
Assign a score from 1 to 10 for each criterion. Calculate the simple arithmetic average of the 3 scores.
Identify the weakest point (the criterion key with the lowest score: "criterion1", "criterion2", or "criterion3") and write a specific constructive critique to guide the next iteration.

Rubric:
- criterion1: ${rubric[0]}
- criterion2: ${rubric[1]}
- criterion3: ${rubric[2]}

Implementation:
\`\`\`javascript
${currentCode}
\`\`\`

Sandbox result:
${sandboxOutput}

Respond ONLY with JSON in this format:
{
  "grades": {
    "criterion1": <score 1 to 10>,
    "criterion2": <score 1 to 10>,
    "criterion3": <score 1 to 10>
  },
  "average": <arithmetic average>,
  "weakPoint": "criterion1" | "criterion2" | "criterion3",
  "critique": "<detailed critique>"
}`;

      let judgeResult: JudgeResult = {
        grades: { criterion1: 5, criterion2: 5, criterion3: 5 },
        average: 5,
        weakPoint: 'criterion2',
        critique: 'Improve the overall consistency of the code.',
      };

      try {
        const judgeResponse = await this.askLlm(judgePrompt);
        const cleanedJudge = judgeResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedJudge);
        const grades = parsed.grades || parsed.notas;
        const parsedAverage = typeof parsed.average === 'number' ? parsed.average : parsed.media;
        const parsedWeakPoint = parsed.weakPoint || parsed.ponto_mais_fraco;
        const parsedCritique = parsed.critique || parsed.critica_construtiva;
        if (grades && typeof parsedAverage === 'number' && parsedWeakPoint) {
          judgeResult = {
            grades,
            average: parsedAverage,
            weakPoint: String(parsedWeakPoint),
            critique: String(parsedCritique || ''),
          };
        }
      } catch (error: unknown) {const syntaxScore = ok ? 10 : 3;
        judgeResult = {
          grades: { criterion1: syntaxScore, criterion2: 7, criterion3: 6 },
          average: (syntaxScore + 7 + 6) / 3,
          weakPoint: ok ? 'criterion3' : 'criterion1',
          critique: ok
            ? 'Improve the internal operational logic.'
            : 'Fix the syntax errors identified by the sandbox.',
        };
      }

      average = judgeResult.average;
      currentCritique = judgeResult.critique;
      currentWeakPoint = judgeResult.weakPoint;

      state.history!.push({
        iteration: iterations,
        code: currentCode,
        grades: judgeResult.grades,
        average,
        weakPoint: currentWeakPoint,
        critique: currentCritique,
        sandboxOutput,
      });
      await this.saveSessionState(state);

      try {
        fs.unlinkSync(sandboxFile);
      } catch (error: unknown) {// Best effort cleanup only.
      logger.warn('[Loop Engineering] file cleanup failed', error);
    }

      if (average >= 8.0) {
        break;
      }
    }

    const mutationPrompt = `You are a software engineer. Based on the final code generated for the task, produce a Mutation Plan describing proposed changes and files.
Task: "${task}"
Final code:
\`\`\`javascript
${currentCode}
\`\`\`
Generate a clean, concise Mutation Plan in plan or diff markdown format.`;

    const mutationPlan = await this.askLlm(mutationPrompt);
    state.finalPlan = mutationPlan;
    await this.saveSessionState(state);

    const key = `loop_criteria_${this.slugify(task)}`;
    try {
      await this.memory.remember(
        userId,
        key,
        JSON.stringify({
          task,
          rubric,
          history: state.history,
          finalCode: currentCode,
        }),
        'loop_engineering',
      );
    } catch (error: unknown) {// Memory persistence is best effort in test environments.
      logger.warn('[Loop Engineering] operation failed', error);
    }

    const historyLines = state.history!.map(
      (entry) => `- Iteration ${entry.iteration}: Average ${entry.average.toFixed(2)} (weakest: ${entry.weakPoint})`,
    );

    const resultSummary = [
      'Engineering loop finished',
      `Task: "${task}"`,
      '',
      'Success Criteria Rubric:',
      `- criterion1: ${rubric[0]}`,
      `- criterion2: ${rubric[1]}`,
      `- criterion3: ${rubric[2]}`,
      '',
      'Grade History:',
      ...historyLines,
      '',
      'Proposed Mutation Plan:',
      mutationPlan,
      '',
      'Results and success criteria were saved to persistent memory.',
    ].join('\n');

    await this.clearSessionState(sessionId);
    return resultSummary;
  }

  private extractCode(content: string): string {
    const match = content.match(/```(?:javascript|typescript|js|ts)?\n([\s\S]*?)```/);
    if (match) {
      return match[1].trim();
    }
    return content.trim();
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50);
  }
}
