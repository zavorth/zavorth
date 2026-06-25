import type {
  DashboardBudgetSnapshot,
} from "../contracts";

type LooseRecord = Record<string, any>;

function asArray<T = LooseRecord>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asText(value: unknown, fallback = ""): string {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asRecord(value: unknown): LooseRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as LooseRecord
    : null;
}

export function asCommandCenterTextArray(value: unknown): string[] | undefined {
  const items = asArray<unknown>(value)
    .map((entry) => asText(entry))
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function resolveModelPicker(input: LooseRecord): LooseRecord | null {
  return asRecord(input.modelPicker)
    || asRecord(input.runtime?.modelPicker)
    || asRecord(input.state?.modelPicker)
    || asRecord(input.runtime?.gatewayControlApi?.modelPicker)
    || asRecord(input.state?.gatewayControlApi?.modelPicker);
}

function resolveSelectedModel(input: LooseRecord): LooseRecord | null {
  return asRecord(resolveModelPicker(input)?.selected);
}

export function resolveCommandCenterAgentRun(input: LooseRecord): LooseRecord | null {
  return asRecord(input.agentRun)
    || asRecord(input.runtime?.agentRun)
    || asRecord(input.state?.agentRun);
}

export function resolveCommandCenterAgentRunMetadata(input: LooseRecord): LooseRecord | null {
  const run = resolveCommandCenterAgentRun(input);
  return asRecord(run?.metadata)
    || asRecord(run?.meta)
    || null;
}

export function resolveCommandCenterProviderRouteBudgetCorrelation(input: LooseRecord): LooseRecord | null {
  const run = resolveCommandCenterAgentRun(input);
  const metadata = resolveCommandCenterAgentRunMetadata(input);
  return asRecord(metadata?.providerRouteBudgetCorrelation)
    || asRecord(run?.providerRouteBudgetCorrelation)
    || asRecord(input.runtime?.providerRouteBudgetCorrelation)
    || asRecord(input.state?.providerRouteBudgetCorrelation)
    || null;
}

export function resolveCommandCenterModelPickerSelection(input: LooseRecord): LooseRecord | null {
  const metadata = resolveCommandCenterAgentRunMetadata(input);
  const correlation = resolveCommandCenterProviderRouteBudgetCorrelation(input);
  return asRecord(metadata?.modelPickerSelection)
    || asRecord(correlation?.modelPicker)
    || resolveSelectedModel(input);
}

export function resolveCommandCenterRunBudget(input: LooseRecord): LooseRecord | null {
  const run = resolveCommandCenterAgentRun(input);
  const metadata = resolveCommandCenterAgentRunMetadata(input);
  const correlation = resolveCommandCenterProviderRouteBudgetCorrelation(input);
  return asRecord(input.budgetSnapshot)
    || asRecord(input.budget)
    || asRecord(input.runtime?.budget)
    || asRecord(input.state?.budget)
    || asRecord(metadata?.runBudget)
    || asRecord(correlation?.budget)
    || asRecord(run?.runBudget)
    || null;
}

function normalizeBudgetStatus(value: unknown): DashboardBudgetSnapshot["status"] {
  const raw = asText(value).toLowerCase();
  if (raw.includes("exceed") || raw.includes("over") || raw.includes("blocked")) {
    return "exceeded";
  }
  if (raw.includes("warn") || raw.includes("attention") || raw.includes("near")) {
    return "attention";
  }
  if (raw.includes("ok") || raw.includes("ready") || raw.includes("safe")) {
    return "ok";
  }
  return "unknown";
}

export function inferCommandCenterBudgetStatus(raw: LooseRecord | null): DashboardBudgetSnapshot["status"] {
  const explicit = normalizeBudgetStatus(raw?.status ?? raw?.state);
  if (explicit !== "unknown") {
    return explicit;
  }
  if (!raw) {
    return "unknown";
  }
  const estimatedCostUnits = asNumber(raw.estimatedCostUnits);
  const maxEstimatedCostUnits = asNumber(raw.maxEstimatedCostUnits);
  if (
    raw.allowed === false
    || raw.degraded === true
    || (estimatedCostUnits !== undefined && maxEstimatedCostUnits !== undefined && estimatedCostUnits > maxEstimatedCostUnits)
  ) {
    return "exceeded";
  }
  if (asText(raw.reason ?? raw.allReasons?.[0])) {
    return "attention";
  }
  return "ok";
}

export function summarizeCommandCenterBudget(raw: LooseRecord | null): string {
  if (!raw) {
    return "";
  }
  const estimatedCostUnits = asNumber(raw.estimatedCostUnits);
  const maxEstimatedCostUnits = asNumber(raw.maxEstimatedCostUnits);
  const inputChars = asNumber(raw.inputChars);
  const requestedToolCount = asNumber(raw.requestedToolCount);
  const exposedToolCount = asNumber(raw.exposedToolCount);
  const fragments = [
    estimatedCostUnits !== undefined && maxEstimatedCostUnits !== undefined
      ? `custo ${estimatedCostUnits}/${maxEstimatedCostUnits} unidades`
      : estimatedCostUnits !== undefined
        ? `custo ${estimatedCostUnits} unidades`
        : "",
    inputChars !== undefined ? `${inputChars} chars` : "",
    requestedToolCount !== undefined ? `${requestedToolCount} tools solicitadas` : "",
    exposedToolCount !== undefined ? `${exposedToolCount} tools expostas` : "",
  ].filter(Boolean);
  return fragments.join("; ");
}
