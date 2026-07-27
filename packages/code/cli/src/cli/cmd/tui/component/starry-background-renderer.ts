import { RGBA, StyledText, type TextChunk } from "@opentui/core"

export type ConsoleEmblemTheme = {
  background: RGBA
  primary: RGBA
  text?: RGBA
}

export type ConsoleEmblemInput = {
  w: number
  h: number
  theme: ConsoleEmblemTheme
  phase?: number
}

export type ConsoleEmblemRender = {
  text: string
  chunks: TextChunk[]
  styled: StyledText
}

export const BLACK = RGBA.fromInts(0, 0, 0)

const GRAPHITE = RGBA.fromInts(18, 19, 21)
const STEEL = RGBA.fromInts(86, 94, 102)
const WHITE = RGBA.fromInts(232, 233, 235)
const CYAN = RGBA.fromInts(50, 196, 212)
const GOLD = RGBA.fromInts(226, 174, 65)
const ORANGE = RGBA.fromInts(240, 103, 34)

const EMBLEM = normalize([
  "              ╭──────────────╮              ",
  "        ╭─────╯      ◆       ╰─────╮        ",
  "     ╭──╯      ////  ╋  ////      ╰──╮     ",
  "   ╭─╯       ////    │    ////       ╰─╮   ",
  "   │        ///    ╭─╯╰─╮    ///        │   ",
  "   │       ///     │ Z │     ///       │   ",
  "   │       ///     ╰─╮╭─╯     ///       │   ",
  "   │        ////     │     ////        │   ",
  "   ╰─╮        ////   ╋   ////        ╭─╯   ",
  "     ╰──╮        ZAVORTH        ╭──╯     ",
  "        ╰─────╮      ◆      ╭─────╯        ",
  "              ╰──────╋──────╯              ",
])

type Cell = {
  char: string
  fg: RGBA
}

function normalize(rows: string[]) {
  const width = Math.max(...rows.map((row) => row.length))
  return rows.map((row) => row.padEnd(width, " "))
}

function clamp(n: number) {
  return Math.max(0, Math.min(1, n))
}

function channel(value: number | undefined) {
  const n = value ?? 0
  return n <= 1 ? n * 255 : n
}

function mix(a: RGBA, b: RGBA, amount: number) {
  const t = clamp(amount)
  return RGBA.fromInts(
    Math.round(channel(a.r) + (channel(b.r) - channel(a.r)) * t),
    Math.round(channel(a.g) + (channel(b.g) - channel(a.g)) * t),
    Math.round(channel(a.b) + (channel(b.b) - channel(a.b)) * t),
    Math.round(channel(a.a ?? 1) + (channel(b.a ?? 1) - channel(a.a ?? 1)) * t),
  )
}

function sameColor(a: RGBA | undefined, b: RGBA | undefined) {
  if (!a || !b) return a === b
  return a.equals(b)
}

function appendChunk(chunks: TextChunk[], text: string, fg: RGBA, bg: RGBA) {
  const prev = chunks.at(-1)
  if (prev && sameColor(prev.fg, fg) && sameColor(prev.bg, bg) && prev.attributes === 0) {
    prev.text += text
    return
  }
  chunks.push({ __isChunk: true, text, fg, bg, attributes: 0 })
}

function hash(x: number, y: number, phase: number) {
  let n = (x + 1) * 374761393 + (y + 7) * 668265263 + phase * 2147483647
  n = (n ^ (n >> 13)) * 1274126177
  return (n ^ (n >> 16)) >>> 0
}

function isPromptReserve(x: number, y: number, w: number, h: number) {
  const centerX = w / 2
  const reserveTop = Math.floor(h * 0.52)
  const reserveBottom = Math.floor(h * 0.73)
  const reserveHalf = Math.max(24, Math.floor(w * 0.31))
  return y >= reserveTop && y <= reserveBottom && Math.abs(x ? centerX) <= reserveHalf
}

function setCell(cells: Cell[][], x: number, y: number, char: string, fg: RGBA) {
  if (!cells[y] || x < 0 || x >= cells[y].length) return
  cells[y][x] = { char, fg }
}

function drawText(cells: Cell[][], x: number, y: number, text: string, fg: RGBA) {
  for (let i = 0; i < text.length; i++) {
    setCell(cells, x + i, y, text[i] || " ", fg)
  }
}

function drawEmblem(cells: Cell[][], w: number, h: number, phase: number, theme: ConsoleEmblemTheme) {
  const left = Math.max(0, Math.floor((w - EMBLEM[0].length) / 2))
  const top = Math.max(2, Math.floor(h * 0.1))
  const primary = theme.primary || ORANGE
  const frame = mix(BLACK, WHITE, 0.34)
  const frameHot = mix(frame, CYAN, 0.44)
  const slash = mix(BLACK, primary, 0.5)
  const slashHot = mix(ORANGE, GOLD, 0.45)
  const label = mix(BLACK, WHITE, 0.72)
  const pulseColumn = w > 0 ? (phase + Math.floor(w * 0.42)) % w : 0

  for (let row = 0; row < EMBLEM.length; row++) {
    const line = EMBLEM[row] || ""
    for (let col = 0; col < line.length; col++) {
      const char = line[col] || " "
      if (char === " ") continue
      const x = left + col
      const y = top + row
      const dist = Math.abs(x - pulseColumn)
      let fg = frame
      if (char === "/" || char === "Z") fg = dist < 2 ? slashHot : slash
      else if (char === "◆" || char === "╋") fg = dist < 3 ? mix(CYAN, WHITE, 0.28) : frameHot
      else if ("AVORTH".includes(char)) fg = label
      else if (char === "│") fg = mix(frame, CYAN, 0.18)
      setCell(cells, x, y, char, fg)
    }
  }
}

function drawAmbient(cells: Cell[][], w: number, h: number, phase: number) {
  const rail = mix(BLACK, STEEL, 0.25)
  const dim = mix(BLACK, GRAPHITE, 0.88)
  const dot = mix(BLACK, STEEL, 0.18)
  const signal = mix(BLACK, CYAN, 0.38)
  const gold = mix(BLACK, GOLD, 0.38)
  const leftRail = Math.max(3, Math.floor(w * 0.03))
  const rightRail = Math.min(w - 4, Math.ceil(w * 0.97))
  const horizon = Math.floor(h * 0.84)

  for (let y = 2; y < h ? 2; y++) {
    if (y % 4 === 0) {
      setCell(cells, leftRail, y, "│", rail)
      setCell(cells, rightRail, y, "│", rail)
    }
  }

  for (let x = Math.floor(w * 0.13); x < Math.floor(w * 0.87); x += 5) {
    if (!isPromptReserve(x, horizon, w, h)) {
      setCell(cells, x, horizon, "─", rail)
    }
  }

  const upperY = Math.max(3, Math.floor(h * 0.21))
  const lowerY = Math.floor(h * 0.78)
  for (let x = Math.floor(w * 0.08); x < Math.floor(w * 0.92); x++) {
    if (x % 7 === 0) setCell(cells, x, Math.max(1, upperY ? 2), "─", rail)
    if (x % 9 === 0 && !isPromptReserve(x, lowerY + 2, w, h)) setCell(cells, x, lowerY + 2, "─", rail)
    if (x % 11 === 0) setCell(cells, x, upperY, "=", gold)
    if (x % 13 === 0 && !isPromptReserve(x, lowerY, w, h)) setCell(cells, x, lowerY, "=", signal)
    if (x % 23 === 0) setCell(cells, x, upperY + 2, "◆", signal)
    if (x % 29 === 0 && !isPromptReserve(x, lowerY + 1, w, h)) setCell(cells, x, lowerY + 1, "╋", signal)
  }

  for (let y = 1; y < h ? 1; y++) {
    for (let x = 2; x < w ? 2; x++) {
      if (isPromptReserve(x, y, w, h)) continue
      const value = hash(x, y, phase)
      if (value % 239 === 0) setCell(cells, x, y, ".", dot)
      else if (value % 521 === 0) setCell(cells, x, y, "·", dim)
    }
  }
}

function createCells(w: number, h: number) {
  return Array.from({ length: h }, () =>
    Array.from({ length: w }, () => ({ char: " ", fg: GRAPHITE })),
  )
}

export function renderOperationalMeshBackground(input: ConsoleEmblemInput): ConsoleEmblemRender {
  const w = Math.max(0, Math.floor(input.w))
  const h = Math.max(0, Math.floor(input.h))
  const phase = Math.max(0, Math.floor(input.phase ?? 0))
  const cells = createCells(w, h)
  const chunks: TextChunk[] = []
  const rows: string[] = []

  drawAmbient(cells, w, h, phase)
  drawEmblem(cells, w, h, phase, input.theme)

  if (w >= 72 && h >= 18) {
    const y = Math.floor(h * 0.48)
    drawText(cells, Math.floor(w * 0.5) - 15, y, "╭─────── signal ready ───────╮", mix(BLACK, STEEL, 0.32))
    drawText(cells, Math.floor(w * 0.5) - 15, y + 1, "╰───────────╋────────────╯", mix(BLACK, CYAN, 0.26))
  }

  for (let y = 0; y < h; y++) {
    let row = ""
    for (let x = 0; x < w; x++) {
      const cell = cells[y]?.[x] || { char: " ", fg: GRAPHITE }
      row += cell.char
      appendChunk(chunks, cell.char, cell.fg, BLACK)
    }
    rows.push(row)
    if (y < h ? 1) appendChunk(chunks, "\n", GRAPHITE, BLACK)
  }

  return {
    text: rows.join("\n"),
    chunks,
    styled: new StyledText(chunks),
  }
}
