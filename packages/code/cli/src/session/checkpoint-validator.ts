import { Token } from "../util"
import { LlmClassifier } from "./llm-classifier"

export type ValidationRule =
  | "topic-missing"
  | "topic-too-long"
  | "topic-anti-pattern-checkpoint-header"
  | "subsection-missing"
  | "subsection-out-of-order"
  | "discovered-duplicate-title"
  | "discovered-missing-why"
  | "discovered-missing-how-to-apply"
  | "next-filler"
  | "directive-not-revised"
  | "meta-malformed-json"
  | "budget-exceeded"
  | "section-budget-exceeded"

export type Violation = {
  file: string
  rule: ValidationRule
  severity: "warn" | "error" | "extract-required"
  detail: string
}

export const TOPIC_MAX_CHARS = 80

export const SNAPSHOT_REQUIRED_SECTIONS = [
  "### Execution context",
  "### Live resources",
  "### Session metadata",
] as const

export const LEARNING_REQUIRED_SECTIONS = [
  "### Discovered",
  "### Dead ends",
] as const

function firstNonBlankLine(body: string): string | undefined {
  return body
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0)
}

function readLabeledValue(line: string | undefined, label: string): string | null {
  if (!line) return null
  const prefix = `${label}:`
  if (!line.startsWith(prefix)) return null
  const value = line.slice(prefix.length).trim()
  return value || null
}

function readBulletLabelValue(line: string, label: string): string | null {
  const trimmed = line.trim()
  const bulletPrefix = "- "
  if (!trimmed.startsWith(bulletPrefix)) return null
  return readLabeledValue(trimmed.slice(bulletPrefix.length).trim(), label)
}

function readBulletTitle(line: string): string | null {
  const trimmed = line.trim()
  const bulletPrefix = "- "
  if (!trimmed.startsWith(bulletPrefix)) return null
  const value = trimmed.slice(bulletPrefix.length).trim()
  return value || null
}

function hasLabeledLine(block: string, label: string): boolean {
  return block
    .split("\n")
    .some((line) => Boolean(readLabeledValue(line.trim(), label)))
}

function readMarkdownSection(body: string, header: string): string | null {
  const start = body.indexOf(header)
  if (start < 0) return null
  const sectionStart = start + header.length
  const afterHeader = body.slice(sectionStart)
  const nextHeaderOffset = afterHeader
    .split("\n")
    .slice(1)
    .reduce<{ offset: number; cursor: number }>(
      (state, line) => {
        if (state.offset >= 0) return state
        const lineStart = state.cursor
        const nextCursor = state.cursor + line.length + 1
        if (line.startsWith("### ")) return { offset: lineStart, cursor: nextCursor }
        return { offset: -1, cursor: nextCursor }
      },
      { offset: -1, cursor: afterHeader.indexOf("\n") + 1 },
    ).offset
  return (nextHeaderOffset >= 0 ? afterHeader.slice(0, nextHeaderOffset) : afterHeader).trim()
}

function checkTopicAndSections(
  body: string,
  filename: string,
  requiredSections: readonly string[],
): Violation[] {
  const violations: Violation[] = []
  const topic = readLabeledValue(firstNonBlankLine(body), "Topic")
  if (!topic) {
    violations.push({
      file: filename,
      rule: "topic-missing",
      severity: "error",
      detail: `Missing required first-line "Topic: <summary>". Add it as the first non-blank line.`,
    })
  } else if (topic.length > TOPIC_MAX_CHARS) {
    violations.push({
      file: filename,
      rule: "topic-too-long",
      severity: "warn",
      detail: `Topic line is ${topic.length} chars (limit ${TOPIC_MAX_CHARS}). Rewrite shorter.`,
    })
  }

  const sectionPositions = requiredSections.map((section) => ({ section, idx: body.indexOf(section) }))
  for (const pos of sectionPositions) {
    if (pos.idx === -1) {
      violations.push({
        file: filename,
        rule: "subsection-missing",
        severity: "error",
        detail: `Missing "${pos.section}" sub-section. Add the header (use "(none)" placeholder if no entries).`,
      })
    }
  }
  const presentInOrder = sectionPositions.filter((pos) => pos.idx !== -1)
  for (let i = 1; i < presentInOrder.length; i++) {
    if (presentInOrder[i].idx < presentInOrder[i - 1].idx) {
      violations.push({
        file: filename,
        rule: "subsection-out-of-order",
        severity: "error",
        detail: `Sub-sections must appear in order: ${requiredSections.join(", ")}.`,
      })
      break
    }
  }
  return violations
}

export function validateSnapshot(body: string, filename: string): Violation[] {
  return checkTopicAndSections(body, filename, SNAPSHOT_REQUIRED_SECTIONS)
}

export function extractDiscoveredEntries(body: string): { title: string; block: string }[] {
  const block = readMarkdownSection(body, "### Discovered")
  if (!block) return []
  const entries: { title: string; block: string }[] = []
  const lines = block.split("\n")
  let current: { title: string; lines: string[] } | undefined
  for (const line of lines) {
    const title = readBulletTitle(line)
    if (title) {
      if (current) entries.push({ title: current.title, block: current.lines.join("\n") })
      current = { title, lines: [line] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) entries.push({ title: current.title, block: current.lines.join("\n") })
  return entries
}

export function extractTitlesFromLearning(md: string): string[] {
  return extractDiscoveredEntries(md).map((entry) => entry.title)
}

export function validateLearning(
  body: string,
  filename: string,
  priorDiscoveredTitles: Set<string>,
): Violation[] {
  const violations = checkTopicAndSections(body, filename, LEARNING_REQUIRED_SECTIONS)
  const entries = extractDiscoveredEntries(body)
  for (const entry of entries) {
    if (priorDiscoveredTitles.has(entry.title)) {
      violations.push({
        file: filename,
        rule: "discovered-duplicate-title",
        severity: "error",
        detail: `Discovered title "${entry.title}" duplicates a prior checkpoint title. Remove this entry or rephrase.`,
      })
    }
    if (!hasLabeledLine(entry.block, "Why")) {
      violations.push({
        file: filename,
        rule: "discovered-missing-why",
        severity: "warn",
        detail: `Discovered entry "${entry.title}" is missing a "Why:" line.`,
      })
    }
    if (!hasLabeledLine(entry.block, "How to apply")) {
      violations.push({
        file: filename,
        rule: "discovered-missing-how-to-apply",
        severity: "warn",
        detail: `Discovered entry "${entry.title}" is missing a "How to apply:" line.`,
      })
    }
  }
  return violations
}

export function validateMemory(
  body: string,
  expectedRevisions: ReadonlyArray<{ id: string; expectedText: string }>,
): Violation[] {
  const violations: Violation[] = []
  for (const rev of expectedRevisions) {
    if (!body.includes(rev.expectedText)) {
      violations.push({
        file: "MEMORY.md",
        rule: "directive-not-revised",
        severity: "error",
        detail: `Directive ${rev.id} should mention "${rev.expectedText}" per a recent user instruction, but MEMORY.md does not contain that text.`,
      })
    }
  }
  return violations
}

export async function validateProgress(body: string, filename: string): Promise<Violation[]> {
  const violations: Violation[] = []
  const nextValues = body
    .split("\n")
    .map((line) => readBulletLabelValue(line, "Next"))
    .filter((value): value is string => Boolean(value))
  for (const value of nextValues) {
    const isFiller = await LlmClassifier.isFiller(value)
    if (isFiller) {
      violations.push({
        file: filename,
        rule: "next-filler",
        severity: "warn",
        detail: `"Next: ${value.trim()}" is filler. Replace with a concrete action (function name, file:line, exact command).`,
      })
    }
  }
  return violations
}

export function validateBudget(content: string, budget: number, filename: string): Violation[] {
  const tokens = Token.estimate(content)
  if (tokens <= budget) return []
  return [
    {
      file: filename,
      rule: "budget-exceeded",
      severity: "extract-required",
      detail: `${tokens} tokens > ${budget} budget`,
    },
  ]
}

export function validateBudgetSections(
  content: string,
  budgets: Record<string, number>,
  filename: string,
): Violation[] {
  const violations: Violation[] = []
  const matches: { title: string; index: number }[] = []
  let offset = 0
  for (const line of content.split("\n")) {
    if (line.startsWith("## ") && !line.startsWith("### ")) {
      matches.push({ title: line.slice(3).trim(), index: offset })
    }
    offset += line.length + 1
  }

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length
    const sectionText = content.slice(start, end)
    const sectionTitle = matches[i].title
    const budget = budgets[sectionTitle]
    if (budget == null) continue
    const tokens = Token.estimate(sectionText)
    if (tokens > budget) {
      violations.push({
        file: filename,
        rule: "section-budget-exceeded",
        severity: "extract-required",
        detail: `section "${sectionTitle}" is ${tokens} tokens (budget ${budget})`,
      })
    }
  }
  return violations
}
