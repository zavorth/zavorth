import * as fs from 'fs';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { LlmRuntimeService } from './llm/LlmRuntimeService.js';
import { MemoryService } from './MemoryService.js';
import type { ChatMessage } from '../providers/ILlmProvider.js';

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
    } catch {
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
      } catch {
        // Ignorar erros na remoção
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
    options: { auto?: boolean; grill?: boolean; userId?: string } = {}
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
      return `[Modo Guiado] Iniciando perguntas para esclarecer a tarefa:\n\n1️⃣ Pergunta: ${questions[0]}`;
    }

    // Sem flags: menu interativo
    state.status = 'WAITING_FOR_LOOP_MODE';
    await this.saveSessionState(state);

    return `Selecione o modo de execução para a tarefa:\n"${task}"\n\n1️⃣ Automático (--auto)\n2️⃣ Guiado (--grill)\n\nDigite 1 ou 2 para selecionar, ou 'exit' para cancelar.`;
  }

  public async processInput(sessionId: string, userId: string, userInput: string): Promise<string> {
    const state = await this.getSessionState(sessionId);
    if (state.status === 'IDLE') {
      return 'Nenhum loop ativo. Use o comando /loop <tarefa> para iniciar.';
    }

    const cleanInput = userInput.trim();

    if (state.status === 'WAITING_FOR_LOOP_MODE') {
      if (cleanInput === '1' || cleanInput.toLowerCase().includes('auto')) {
        state.status = 'EXECUTING_LOOP';
        state.mode = 'auto';
        await this.saveSessionState(state);
        return this.runAutoLoop(sessionId, userId, state.task);
      } else if (cleanInput === '2' || cleanInput.toLowerCase().includes('grill')) {
        state.status = 'GRILLING';
        state.mode = 'grill';
        const questions = await this.generateGrillQuestions(state.task);
        state.grillState = {
          questions,
          currentQuestionIndex: 0,
          answers: [],
        };
        await this.saveSessionState(state);
        return `[Modo Guiado] Iniciando perguntas para esclarecer a tarefa:\n\n1️⃣ Pergunta: ${questions[0]}`;
      } else {
        return `Seleção inválida.\n\nSelecione o modo de execução para a tarefa:\n"${state.task}"\n\n1️⃣ Automático (--auto)\n2️⃣ Guiado (--grill)\n\nDigite 1 ou 2 para selecionar, ou 'exit' para cancelar.`;
      }
    }

    if (state.status === 'GRILLING') {
      if (!state.grillState) {
        state.status = 'IDLE';
        await this.clearSessionState(sessionId);
        return 'Estado inválido detectado. O loop foi resetado.';
      }

      state.grillState.answers.push(cleanInput);
      const nextIndex = state.grillState.currentQuestionIndex + 1;
      state.grillState.currentQuestionIndex = nextIndex;

      if (nextIndex < state.grillState.questions.length) {
        await this.saveSessionState(state);
        return `Question ${nextIndex + 1}: ${state.grillState.questions[nextIndex]}`;
      } else {
        // Todas respondidas! Executar loop guiado
        state.status = 'EXECUTING_LOOP';
        await this.saveSessionState(state);
        return this.runGrillLoop(sessionId, userId, state.task, state.grillState.answers);
      }
    }

    return 'O loop está executando, aguarde a conclusão.';
  }

  private async generateGrillQuestions(task: string): Promise<string[]> {
    const prompt = `Você é um Engenheiro de Requisitos especialista. Analise a seguinte tarefa de engenharia e gere uma lista contendo entre 2 e 5 perguntas claras e diretas para esclarecer os critérios de sucesso técnico e os requisitos da tarefa.
Responda APENAS com um array JSON de strings no formato:
["Pergunta 1", "Pergunta 2", ...]

Tarefa: "${task}"`;

    try {
      const response = await this.askLlm(prompt);
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed) && parsed.length >= 2 && parsed.length <= 5) {
        return parsed.map(String);
      }
    } catch {
      // Ignorar erro e prosseguir para o fallback
    }

    return [
      'Qual é o comportamento esperado para cenários de erro ou entradas inválidas?',
      'Há alguma restrição de desempenho ou limite de processamento necessário?',
      'Quais são os formatos e tipos das principais saídas esperadas?',
    ];
  }

  private async generateRubric(task: string, answersContext?: string): Promise<string[]> {
    const prompt = `Você é um Engenheiro de QA especialista. Com base na tarefa de engenharia e nas informações fornecidas, gere uma Rubrica contendo exatamente 3 critérios técnicos de sucesso detalhados e mensuráveis para validar a implementação.
Responda APENAS com um JSON no formato:
{
  "criteria": [
    "Critério 1: descrição técnica...",
    "Critério 2: descrição técnica...",
    "Critério 3: descrição técnica..."
  ]
}

Tarefa: "${task}"
${answersContext ? `Respostas fornecidas pelo usuário:\n${answersContext}` : ''}`;

    try {
      const response = await this.askLlm(prompt);
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && Array.isArray(parsed.criteria) && parsed.criteria.length === 3) {
        return parsed.criteria.map(String);
      }
    } catch {
      // Fallback
    }

    return [
      'Critério 1: A sintaxe e estrutura do código devem ser válidas em Javascript.',
      'Critério 2: O código deve implementar a lógica core da tarefa especificada.',
      'Critério 3: O código deve retornar resultados consistentes sem falhas em tempo de execução.',
    ];
  }

  public async runAutoLoop(sessionId: string, userId: string, task: string): Promise<string> {
    const rubric = await this.generateRubric(task);
    return this.executeEngine(sessionId, userId, task, rubric);
  }

  public async runGrillLoop(sessionId: string, userId: string, task: string, answers: string[]): Promise<string> {
    const state = await this.getSessionState(sessionId);
    const questions = state.grillState?.questions || [];
    const answersContext = questions.map((q, i) => `P: ${q}\nR: ${answers[i] || ''}`).join('\n\n');
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

      // 1. Executor LLM gera código
      const executorPrompt = `Você é um Desenvolvedor de Software especialista.
Implemente a solução em Javascript para a seguinte tarefa de engenharia.

Tarefa: "${task}"

Rubrica de Validação:
- criterio1: ${rubric[0]}
- criterio2: ${rubric[1]}
- criterio3: ${rubric[2]}

${
  iterations > 1
    ? `Esta é a iteração ${iterations}. O código gerado na iteração anterior foi:\n\`\`\`javascript\n${currentCode}\n\`\`\`\n\nA avaliação anterior identificou como ponto mais fraco: "${currentWeakPoint}".\nCrítica construtiva: ${currentCritique}\n\nAjuste e aprimore o código para corrigir essa falha e melhorar a nota.`
    : 'Escreva a melhor implementação inicial possível.'
}

Forneça APENAS o código JavaScript funcional completo, sem explicações em markdown fora do código.`;

      const executorResponse = await this.askLlm(executorPrompt);
      currentCode = this.extractCode(executorResponse);

      // 2. Execução no Sandbox (Syntax Check)
      const sandboxFile = path.join(sandboxDir, `sandbox_${sessionId}_iter_${iterations}.js`);
      fs.writeFileSync(sandboxFile, currentCode, 'utf8');

      const checkResult = spawnSync('node', ['-c', sandboxFile], { encoding: 'utf8' });
      const ok = checkResult.status === 0;
      const sandboxOutput = ok
        ? 'Syntax check passed successfully.'
        : `Syntax check failed.\nError:\n${checkResult.stderr || checkResult.stdout}`;

      // 3. Juiz LLM avalia a iteração
      const judgePrompt = `Você é um Juiz de Código especialista. Avalie a seguinte implementação e o resultado da execução do sandbox com base nas 3 regras/critérios da Rubrica técnica.
Atribua uma nota de 1 a 10 para cada critério. Calcule a média aritmética simples das 3 notas.
Identifique o ponto mais fraco (a chave do critério com menor nota: "criterio1", "criterio2" ou "criterio3") e escreva uma crítica construtiva específica para guiar a melhora desse ponto na próxima iteração.

Rubrica:
- criterio1: ${rubric[0]}
- criterio2: ${rubric[1]}
- criterio3: ${rubric[2]}

Implementação (código):
\`\`\`javascript
${currentCode}
\`\`\`

Resultado do Sandbox (Syntax/Compile Check):
${sandboxOutput}

Responda APENAS com um JSON no seguinte formato:
{
  "notas": {
    "criterio1": <nota 1 a 10>,
    "criterio2": <nota 1 a 10>,
    "criterio3": <nota 1 a 10>
  },
  "media": <média aritmética>,
  "ponto_mais_fraco": "criterio1" | "criterio2" | "criterio3",
  "critica_construtiva": "<crítica detalhada>"
}`;

      let judgeResult = {
        notas: { criterio1: 5, criterio2: 5, criterio3: 5 },
        media: 5,
        ponto_mais_fraco: 'criterio2',
        critica_construtiva: 'Melhore a consistência geral do código.',
      };

      try {
        const judgeResponse = await this.askLlm(judgePrompt);
        const cleanedJudge = judgeResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedJudge);
        if (parsed && parsed.notas && typeof parsed.media === 'number' && parsed.ponto_mais_fraco) {
          judgeResult = parsed;
        }
      } catch {
        // Fallback robusto se falhar parsing
        const isSyntaxOk = ok ? 10 : 3;
        judgeResult = {
          notas: { criterio1: isSyntaxOk, criterio2: 7, criterio3: 6 },
          media: (isSyntaxOk + 7 + 6) / 3,
          ponto_mais_fraco: ok ? 'criterio3' : 'criterio1',
          critica_construtiva: ok
            ? 'Aprimore a lógica operacional interna.'
            : 'Corrija os erros de sintaxe identificados no sandbox.',
        };
      }

      average = judgeResult.media;
      currentCritique = judgeResult.critica_construtiva;
      currentWeakPoint = judgeResult.ponto_mais_fraco;

      state.history!.push({
        iteration: iterations,
        code: currentCode,
        grades: judgeResult.notas,
        average,
        weakPoint: currentWeakPoint,
        critique: currentCritique,
        sandboxOutput,
      });
      await this.saveSessionState(state);

      // Clean up sandbox file to respect file hygiene
      try {
        fs.unlinkSync(sandboxFile);
      } catch {
        // ignore
      }

      if (average >= 8.0) {
        break;
      }
    }

    // 4. Mutation Plan & Diff Proposal
    const mutationPrompt = `Você é um Engenheiro de Software. Com base no código final gerado para a tarefa, gere um Plano de Mutação (Mutation Plan) detalhando as alterações e arquivos propostos.
Tarefa: "${task}"
Código Final:
\`\`\`javascript
${currentCode}
\`\`\`
Gere um Mutation Plan limpo e conciso em formato de plano ou diff markdown.`;

    const mutationPlan = await this.askLlm(mutationPrompt);
    state.finalPlan = mutationPlan;
    await this.saveSessionState(state);

    // 5. Persistir em Memória de Longo Prazo
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
        'loop_engineering'
      );
    } catch {
      // Ignora erro de BD em ambiente de teste
    }

    // Formatar output final de apresentação
    const historyLines = state.history!.map(
      (h) => `- Iteração ${h.iteration}: Média ${h.average.toFixed(2)} (Mais fraco: ${h.weakPoint})`
    );

    const resultSummary = [
      '🚀 **Loop de Engenharia Finalizado**',
      `Tarefa: "${task}"`,
      '',
      '📋 **Critérios de Sucesso (Rubrica):**',
      `- criterio1: ${rubric[0]}`,
      `- criterio2: ${rubric[1]}`,
      `- criterio3: ${rubric[2]}`,
      '',
      '📈 **Histórico de Notas:**',
      ...historyLines,
      '',
      '🔍 **Plano de Mutação Proposto:**',
      mutationPlan,
      '',
      '💾 Resultados e critérios de sucesso salvos na memória persistente.',
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
