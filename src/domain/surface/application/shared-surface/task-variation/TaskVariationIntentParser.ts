import type { IMessageContext } from "../../../../../contracts/IMessageBroker.js";
import type { Task } from "../../../../../contracts/TaskContract.js";
import type {
  NaturalTaskVariationIntent,
  SharedSurfaceTaskVariationCommandPackDeps,
  TaskVariationConversationState,
  TaskVariationPreviewOption,
} from "./TaskVariationTypes.js";

export class TaskVariationIntentParser {
  public constructor(
    private readonly deps: SharedSurfaceTaskVariationCommandPackDeps,
  ) {}

  public parseNaturalTaskVariationIntent(
    rawText: string,
  ): NaturalTaskVariationIntent | null {
    const original = String(rawText || "").trim();
    const normalized = this.deps.normalizeNaturalText(rawText);
    if (!normalized || normalized.startsWith("/")) {
      return null;
    }

    const previewSelection =
      this.extractNaturalTaskVariationPreviewSelection(normalized);
    if (previewSelection) {
      const taskId = this.extractNaturalTaskId(normalized);
      const option =
        this.getTaskVariationPreviewOptions()[previewSelection - 1];
      if (!option) {
        return null;
      }
      if (taskId) {
        return {
          taskId,
          adjustment: option.adjustment,
          intro: `Entendi que voce quer abrir a ${this.describeOrdinalVariationOption(previewSelection)} da tarefa ${taskId}.`,
        };
      }
      return {
        resolveRecent: {
          keywords: this.deps.extractRecentTaskContextKeywords(original),
        },
        adjustment: option.adjustment,
        intro: `Entendi que voce quer abrir a ${this.describeOrdinalVariationOption(previewSelection)} da tarefa recente.`,
      };
    }

    const wantsPreview =
      /\b(mostre|mostrar|mostra|ver|veja|quero ver)\b/.test(normalized) &&
      /\b(opcoes|opcao|alternativas|variacoes|versoes|possibilidades)\b/.test(
        normalized,
      ) &&
      /\b(antes de abrir|antes de criar|antes da nova task|antes de abrir a nova task|antes de criar a nova task)\b/.test(
        normalized,
      );
    const compareTarget =
      this.extractNaturalTaskVariationCompareTarget(normalized);
    const wantsComparison =
      /\b(qual|quais)\b/.test(normalized) &&
      /\b(melhor|melhores)\b/.test(normalized) &&
      /\b(variacao|variacoes|versao|versoes|opcao|opcoes)\b/.test(normalized) &&
      (/\b(dessa|dessas|desses|disso)\b/.test(normalized) ||
        Boolean(compareTarget));
    const mentionsVariation =
      /\b(repita|repetir|mesma coisa|mesmo pedido|nova versao|nova variacao|outra versao|outra variacao)\b/.test(
        normalized,
      ) ||
      /\b(faca igual|fazer igual|adapta|adaptar|adapte|mesmo formato|mantem a ideia|mantenha a ideia)\b/.test(
        normalized,
      ) ||
      /\bagora faz(?: isso)?\s+(?:para|pro|pra)\b/.test(normalized) ||
      /\b(?:faz|faca)(?:\s+isso)?\s+(?:para|pro|pra)\b/.test(normalized) ||
      /\b(?:faz|faca)(?:\s+(?:a|uma))?\s+(?:nova|outra)?\s*versao\b/.test(
        normalized,
      ) ||
      /^(?:deixa|deixe)\s+(?:mais|menos)\s+(?:curto|curta|tecnico|tecnica|marketing|detalhado|detalhada|executivo|executiva|objetivo|objetiva)\b/.test(
        normalized,
      ) ||
      /^(?:faca|faz)\s+mais\s+(?:tecnico|tecnica|detalhado|detalhada|executivo|executiva|objetivo|objetiva)\b/.test(
        normalized,
      ) ||
      /^(?:mais|menos)\s+(?:curto|curta|tecnico|tecnica|marketing|detalhado|detalhada|executivo|executiva|objetivo|objetiva)\b/.test(
        normalized,
      ) ||
      wantsPreview ||
      wantsComparison;
    const explicitReference =
      /\b(task|tarefa|trabalho|pedido)\b/.test(normalized) ||
      /\b(isso|disso|nisso|nisto)\b/.test(normalized) ||
      /\b(ultima tarefa|ultimo pedido|trabalho anterior|pedido anterior)\b/.test(
        normalized,
      );
    const impliedRecentReference =
      /\b(mesma coisa|mesmo pedido|faca igual|fazer igual|de novo|outra versao|outra variacao|mesmo formato|mantem a ideia|mantenha a ideia)\b/.test(
        normalized,
      ) ||
      /\bagora faz(?: isso)?\s+(?:para|pro|pra)\b/.test(normalized) ||
      /^(?:deixa|deixe|faca|faz|mais|menos)\b/.test(normalized) ||
      /\b(dessa|dessas|opcao|opcoes|variacao|variacoes|versao|versoes)\b/.test(
        normalized,
      );
    const mentionsReference = explicitReference || impliedRecentReference;

    if (!mentionsVariation || !mentionsReference) {
      return null;
    }

    if (wantsComparison) {
      const taskId = this.extractNaturalTaskId(normalized);
      if (taskId) {
        return {
          taskId,
          compareOnly: true,
          compareTarget,
          intro: `Entendi que voce quer uma recomendacao de variacao antes de abrir algo novo para a tarefa ${taskId}.`,
        };
      }
      return {
        resolveRecent: {
          keywords: this.deps.extractRecentTaskContextKeywords(original),
        },
        compareOnly: true,
        compareTarget,
        intro:
          "Entendi que voce quer uma recomendacao de variacao antes de abrir algo novo para a tarefa recente.",
      };
    }

    if (wantsPreview) {
      const taskId = this.extractNaturalTaskId(normalized);
      if (taskId) {
        return {
          taskId,
          previewOnly: true,
          intro: `Entendi que voce quer ver as opcoes antes de abrir uma nova variacao da tarefa ${taskId}.`,
        };
      }

      return {
        resolveRecent: {
          keywords: this.deps.extractRecentTaskContextKeywords(original),
        },
        previewOnly: true,
        intro:
          "Entendi que voce quer ver as opcoes antes de abrir uma nova variacao da tarefa recente.",
      };
    }

    const adjustment = this.extractNaturalTaskVariationAdjustment(original);
    if (!adjustment) {
      return null;
    }

    const taskId = this.extractNaturalTaskId(normalized);
    if (taskId) {
      return {
        taskId,
        adjustment,
        intro: `Entendi que voce quer abrir uma nova versao da tarefa ${taskId} com um ajuste explicito.`,
      };
    }

    return {
      resolveRecent: {
        keywords: this.deps.extractRecentTaskContextKeywords(original),
      },
      adjustment,
      intro:
        "Entendi que voce quer abrir uma nova versao canonica da tarefa recente com um ajuste explicito.",
    };
  }

  public parseContextualTaskVariationIntent(
    rawText: string,
    state: TaskVariationConversationState | null,
  ): NaturalTaskVariationIntent | null {
    const normalized = this.deps.normalizeNaturalText(rawText);
    if (!normalized || normalized.startsWith("/") || !state) {
      return null;
    }

    const implicitOrdinal =
      this.extractImplicitTaskVariationPreviewSelection(normalized);
    if (implicitOrdinal) {
      const option = state.previewOptions[implicitOrdinal - 1];
      if (!option) {
        return null;
      }
      return {
        taskId: state.taskId,
        adjustment: option.adjustment,
        intro: `Entendi que voce quer abrir a ${this.describeOrdinalVariationOption(implicitOrdinal)} da conversa recente.`,
      };
    }

    if (
      /\b(vai com a recomendada|segue a recomendada|pode ir na recomendada|abre a recomendada)\b/.test(
        normalized,
      )
    ) {
      if (!state.recommendedOption) {
        return null;
      }
      return {
        taskId: state.taskId,
        adjustment: state.recommendedOption.adjustment,
        intro:
          "Entendi que voce quer seguir com a variacao recomendada na conversa recente.",
      };
    }

    if (
      /\b(abre essa mesmo|abre essa mesma|essa mesmo|essa mesma|vai nessa|pode ser essa)\b/.test(
        normalized,
      )
    ) {
      const chosen = state.recommendedOption || state.previewOptions[0];
      if (!chosen) {
        return null;
      }
      return {
        taskId: state.taskId,
        adjustment: chosen.adjustment,
        intro:
          "Entendi que voce quer seguir com essa mesma variacao da conversa recente.",
      };
    }

    if (
      /\b(faz as duas|abre as duas|quero as duas|pode fazer as duas)\b/.test(
        normalized,
      )
    ) {
      const primary = state.recommendedOption || state.previewOptions[0];
      const secondary = state.secondaryOption || state.previewOptions[1];
      const adjustments = [primary?.adjustment, secondary?.adjustment].filter(
        (entry, index, list): entry is string =>
          Boolean(entry) && list.indexOf(entry) === index,
      );
      if (adjustments.length === 0) {
        return null;
      }
      return {
        taskId: state.taskId,
        adjustments,
        intro:
          adjustments.length >= 2
            ? "Entendi que voce quer abrir as duas melhores variacoes recentes dessa conversa."
            : "Entendi que voce quer abrir a variacao principal dessa conversa.",
      };
    }

    return null;
  }

  public buildTaskVariationPreviewReply(task: Task): string {
    const basePrompt =
      String(task.raw_message || task.normalized_message || "").trim() ||
      "pedido anterior indisponivel";
    const options = this.getTaskVariationPreviewOptions();
    return [
      "Ainda nao abri nenhuma nova task. Aqui estao as opcoes mais naturais para essa variacao:",
      "",
      `Task base: ${task.task_id}`,
      `Pedido base: ${basePrompt}`,
      "",
      "Opcoes:",
      ...options.map((option, index) => `${index + 1}. ${option.label}`),
      "",
      "Se quiser, me diga uma dessas variacoes e eu abro a nova task canonica.",
    ].join("\n");
  }

  public buildTaskVariationRecommendationReply(
    task: Task,
    compareTarget?: string,
  ): string {
    const basePrompt =
      String(task.raw_message || task.normalized_message || "").trim() ||
      "pedido anterior indisponivel";
    const target = String(compareTarget || "").trim();
    const normalizedTarget = this.deps.normalizeNaturalText(target);
    const options = this.getTaskVariationPreviewOptions(compareTarget);
    const primary = options[0]?.adjustment || "deixar mais tecnico";
    let rationale =
      "isso tende a preservar o conteudo base, mas deixa a entrega mais clara e robusta sem espalhar demais a resposta.";

    if (/(telegram|whatsapp|signal|discord|slack)/.test(normalizedTarget)) {
      rationale =
        "para canal de chat, a melhor variacao costuma ser adaptar a entrega para a surface alvo em vez de so mudar o tom.";
    } else if (/(app|web|site|dashboard)/.test(normalizedTarget)) {
      rationale =
        "para app ou web, manter a estrutura consistente costuma facilitar leitura, comparacao e iteracao visual.";
    } else if (/(executivo|gestao|diretoria)/.test(normalizedTarget)) {
      rationale =
        "para publico executivo, o melhor ganho normalmente vem de condensar a mensagem sem perder a intencao original.";
    }

    return [
      "Minha recomendacao para a proxima variacao:",
      "",
      `Task base: ${task.task_id}`,
      `Pedido base: ${basePrompt}`,
      `Melhor opcao agora: ${primary}`,
      `Motivo: ${rationale}`,
      "",
      "Se quiser, posso abrir essa nova task canonica agora.",
    ].join("\n");
  }

  public getTaskVariationPreviewOptions(
    compareTarget?: string,
  ): TaskVariationPreviewOption[] {
    const baseOptions: TaskVariationPreviewOption[] = [
      { label: "deixa mais curto", adjustment: "deixar mais curto" },
      { label: "faz mais tecnico", adjustment: "deixar mais tecnico" },
      { label: "menos marketing", adjustment: "deixar menos marketing" },
      {
        label: "faz isso para slack e telegram",
        adjustment: "adaptar para slack e telegram",
      },
      {
        label: "usa o mesmo formato da anterior",
        adjustment: "usar o mesmo formato da versao anterior",
      },
      {
        label: "mantem a ideia mas deixa mais executivo",
        adjustment: "manter a ideia, mas deixar mais executivo",
      },
    ];
    const target = String(compareTarget || "").trim();
    const normalizedTarget = this.deps.normalizeNaturalText(target);
    if (/(telegram|whatsapp|signal|discord|slack)/.test(normalizedTarget)) {
      return [
        {
          label: `adaptar para ${target || "esse canal"}`,
          adjustment: `adaptar para ${target || "esse canal"}`,
        },
        baseOptions[1],
        baseOptions[0],
        baseOptions[4],
        baseOptions[5],
        baseOptions[2],
      ];
    }
    if (/(app|web|site|dashboard)/.test(normalizedTarget)) {
      return [
        baseOptions[4],
        baseOptions[0],
        baseOptions[1],
        baseOptions[2],
        baseOptions[5],
        baseOptions[3],
      ];
    }
    if (/(executivo|gestao|diretoria)/.test(normalizedTarget)) {
      return [
        baseOptions[5],
        baseOptions[0],
        baseOptions[1],
        baseOptions[4],
        baseOptions[2],
        baseOptions[3],
      ];
    }
    return baseOptions;
  }

  private extractNaturalTaskVariationAdjustment(
    rawText: string,
  ): string | null {
    const contrastedVersionMatch = rawText.match(
      /\b(?:faz|faca)(?:\s+a|\s+uma)?\s+versao\s+(.+?)\s*,?\s*nao\s+a\s+(.+)$/i,
    );
    if (contrastedVersionMatch?.[1] && contrastedVersionMatch?.[2]) {
      return `deixar ${String(contrastedVersionMatch[1]).trim()}, nao ${String(contrastedVersionMatch[2]).trim()}`;
    }

    const multiChannelAdaptationMatch = rawText.match(
      /\b(?:faz|faca)(?:\s+isso)?\s+(?:para|pro|pra)\s+(.+)$/i,
    );
    if (multiChannelAdaptationMatch?.[1]) {
      return `adaptar para ${String(multiChannelAdaptationMatch[1]).trim()}`;
    }

    const compositeVersionMatch = rawText.match(
      /\b(?:faz|faca)(?:\s+uma)?\s+(?:nova|outra)?\s*versao\s+(.+)$/i,
    );
    if (compositeVersionMatch?.[1]) {
      const compositeValue = String(compositeVersionMatch[1]).trim();
      if (this.isNaturalTaskVariationRefinement(compositeValue)) {
        return `deixar ${compositeValue}`;
      }
      return compositeValue;
    }

    const conciseRefinementMatch = rawText.match(/^(?:deixa|deixe)\s+(.+)$/i);
    if (
      conciseRefinementMatch?.[1] &&
      this.isNaturalTaskVariationRefinement(conciseRefinementMatch[1])
    ) {
      return `deixar ${String(conciseRefinementMatch[1]).trim()}`;
    }

    const makeMoreRefinementMatch = rawText.match(/^(?:faz|faca)\s+(.+)$/i);
    if (
      makeMoreRefinementMatch?.[1] &&
      this.isNaturalTaskVariationRefinement(makeMoreRefinementMatch[1])
    ) {
      return `deixar ${String(makeMoreRefinementMatch[1]).trim()}`;
    }

    const bareRefinementMatch = rawText.match(/^(.+)$/i);
    if (
      bareRefinementMatch?.[0] &&
      this.isNaturalTaskVariationRefinement(bareRefinementMatch[0])
    ) {
      return `deixar ${String(bareRefinementMatch[0]).trim()}`;
    }

    const conversationalAdaptationMatch = rawText.match(
      /\bagora\s+faz(?:\s+isso)?\s+(?:para|pro|pra)\s+(.+)$/i,
    );
    if (conversationalAdaptationMatch?.[1]) {
      return `adaptar para ${String(conversationalAdaptationMatch[1]).trim()}`;
    }

    const adaptationMatch = rawText.match(
      /\b(?:adapta(?:r|e)?|adaptar|mesma coisa|mesmo pedido|faca igual|fazer igual)\b.*?\b(?:para|pro|pra)\s+(.+)$/i,
    );
    if (adaptationMatch?.[1]) {
      return `adaptar para ${String(adaptationMatch[1]).trim()}`;
    }

    if (/\busa(?:r)? o mesmo formato(?: da anterior)?\b/i.test(rawText)) {
      return "usar o mesmo formato da versao anterior";
    }

    const preserveIdeaMatch = rawText.match(
      /\b(?:mantem|mantenha)\s+a\s+ideia\b(?:\s*,?\s*mas)?\s+(?:deixa|deixe)\s+(.+)$/i,
    );
    if (preserveIdeaMatch?.[1]) {
      return `manter a ideia, mas deixar ${String(preserveIdeaMatch[1]).trim()}`;
    }

    const alternateVersionMatch = rawText.match(
      /\boutra\s+(?:versao|variacao)\s+(.+)$/i,
    );
    if (alternateVersionMatch?.[1]) {
      return String(alternateVersionMatch[1]).trim();
    }

    const patterns = [
      /\b(?:com|mas|so que)\s+(.+)$/i,
      /\b(?:para|pro|pra)\s+(.+)$/i,
      /\bfocando em\s+(.+)$/i,
      /\bvoltada para\s+(.+)$/i,
      /\bmais\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = rawText.match(pattern);
      const value = String(match?.[1] || "").trim();
      if (value) {
        return value;
      }
    }

    return null;
  }

  private extractNaturalTaskVariationPreviewSelection(
    normalized: string,
  ): number | null {
    const match = normalized.match(
      /\b(?:abre|abrir|abra|usa|usar|quero|escolhe|escolher|pegue|pega)\b.*?\b(a\s+)?(primeira|segunda|terceira|quarta|quinta|sexta|1|2|3|4|5|6)\s+opcao\b/,
    );
    if (!match?.[2]) {
      return null;
    }
    switch (match[2]) {
      case "primeira":
      case "1":
        return 1;
      case "segunda":
      case "2":
        return 2;
      case "terceira":
      case "3":
        return 3;
      case "quarta":
      case "4":
        return 4;
      case "quinta":
      case "5":
        return 5;
      case "sexta":
      case "6":
        return 6;
      default:
        return null;
    }
  }

  private extractImplicitTaskVariationPreviewSelection(
    normalized: string,
  ): number | null {
    const match = normalized.match(
      /\b(?:na verdade\s+)?(primeira|segunda|terceira|quarta|quinta|sexta|1|2|3|4|5|6)\b/,
    );
    if (!match?.[1]) {
      return null;
    }
    return this.extractNaturalTaskVariationPreviewSelection(
      `abre a ${match[1]} opcao`,
    );
  }

  private extractNaturalTaskVariationCompareTarget(
    normalized: string,
  ): string | undefined {
    const channelId = this.deps.extractNaturalChannelId(normalized);
    if (channelId) {
      return this.deps.formatNaturalChannelLabel(channelId);
    }
    const targetMatch = normalized.match(
      /\b(?:para|pro|pra)\s+([a-z0-9._:-]+)\b/,
    );
    return targetMatch?.[1] ? String(targetMatch[1]).trim() : undefined;
  }

  private describeOrdinalVariationOption(index: number): string {
    switch (index) {
      case 1:
        return "primeira opcao";
      case 2:
        return "segunda opcao";
      case 3:
        return "terceira opcao";
      case 4:
        return "quarta opcao";
      case 5:
        return "quinta opcao";
      case 6:
        return "sexta opcao";
      default:
        return `${index}a opcao`;
    }
  }

  private isNaturalTaskVariationRefinement(text: string): boolean {
    const normalized = this.deps.normalizeNaturalText(text);
    return /^(?:(?:mais|menos)\s+(?:curto|curta|tecnico|tecnica|marketing|detalhado|detalhada|executivo|executiva|objetivo|objetiva))(?:\s+e\s+(?:(?:mais|menos)\s+(?:curto|curta|tecnico|tecnica|marketing|detalhado|detalhada|executivo|executiva|objetivo|objetiva)))*$/.test(
      normalized,
    );
  }

  private extractNaturalTaskId(normalized: string): string | null {
    const uuidMatch = normalized.match(
      /\b([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i,
    );
    if (uuidMatch?.[1]) {
      return uuidMatch[1];
    }

    const taskLikeMatch = normalized.match(/\b(task[-:][a-z0-9._:-]+)\b/i);
    if (taskLikeMatch?.[1]) {
      return taskLikeMatch[1];
    }

    const explicitMatch = normalized.match(
      /\b(?:task|tarefa)\s+([a-z0-9][a-z0-9._:-]+)\b/i,
    );
    if (explicitMatch?.[1]) {
      const candidate = explicitMatch[1].trim().toLowerCase();
      if (
        ![
          "de",
          "do",
          "da",
          "para",
          "sobre",
          "ultima",
          "ultimo",
          "anterior",
          "pendente",
          "recente",
        ].includes(candidate)
      ) {
        return explicitMatch[1];
      }
    }

    return null;
  }
}
