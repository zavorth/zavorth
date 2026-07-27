import { createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { RGBA, StyledText, type TextChunk, type TextRenderable } from "@opentui/core"

/**
 * Zavorth mascot — half-block sprite with a quiet idle loop.
 *
 * Critical: sample the 512 canvas on a *square* cell grid (same density X and Y).
 * Independent width/height sampling warps the figure (eyes/body stretch).
 *
 *   sm = 16×7  original proportions (logo)
 *   md = 18×8  home — slightly larger, still correct shape
 *   lg = 20×9  optional
 */

const CANVAS = 512
const GREEN_TOP = RGBA.fromHex("#2A5E2F")
const GREEN_BOT = RGBA.fromHex("#3F7A42")
const EYE = RGBA.fromHex("#000000")
// Match WelcomeBox backgroundPanel (darkStep2)
const VOID = RGBA.fromHex("#121214")

type Rect = { x: number; y: number; w: number; h: number; kind: 1 | 2 }
type Frame = 0 | 1 | 2 | 3

export type MascotSize = "sm" | "md" | "lg"

/** Square cell density per size — rows derived from same grid (never stretched) */
const SIZE_CELLS: Record<MascotSize, number> = {
  sm: 16,
  md: 18,
  lg: 20,
}

function mascotRects(frame: Frame): Rect[] {
  const bob = frame === 1 || frame === 3 ? -12 : 0
  const eyeH = frame === 2 ? 14 : 64
  const footLeftY = 416 + (frame === 1 ? -12 : 0)
  const footRightY = 416 + (frame === 3 ? -12 : 0)
  const antennaY = 64 + bob
  const bridgeY = 192 + bob
  const bodyY = 192 + bob
  const torsoY = 320 + bob
  const eyeY = 240 + bob
  const armLeftY = 256 + bob + (frame === 3 ? -8 : 0)
  const armRightY = 256 + bob + (frame === 1 ? -8 : 0)

  return [
    { x: 128, y: antennaY, w: 64, h: 128, kind: 1 },
    { x: 320, y: antennaY, w: 64, h: 128, kind: 1 },
    { x: 192, y: bridgeY, w: 128, h: 64, kind: 1 },
    { x: 64, y: bodyY, w: 384, h: 128, kind: 1 },
    { x: 0, y: armLeftY, w: 64, h: 64, kind: 1 },
    { x: 448, y: armRightY, w: 64, h: 64, kind: 1 },
    { x: 64, y: torsoY, w: 384, h: 96, kind: 1 },
    { x: 128, y: footLeftY, w: 96, h: 64, kind: 1 },
    { x: 288, y: footRightY, w: 96, h: 64, kind: 1 },
    { x: 160, y: eyeY, w: 32, h: eyeH, kind: 2 },
    { x: 320, y: eyeY, w: 32, h: eyeH, kind: 2 },
  ]
}

function sample(rects: Rect[], px: number, py: number): 0 | 1 | 2 {
  let cell: 0 | 1 | 2 = 0
  for (const r of rects) {
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) cell = r.kind
  }
  return cell
}

function colorOf(cell: 0 | 1 | 2, py: number): RGBA | null {
  if (cell === 0) return null
  if (cell === 2) return EYE
  return py >= 320 ? GREEN_BOT : GREEN_TOP
}

/**
 * Vertical window on the square grid — skip empty top pad (same ratio as original 2/16).
 * (end - start) is always even so half-blocks line up.
 */
function sampleWindow(cells: number): { start: number; end: number; termRows: number } {
  // Original: cells=16 → start=2 → 14 samples → 7 term rows
  let start = Math.round((2 * cells) / 16)
  if ((cells - start) % 2 !== 0) start = Math.max(0, start ? 1)
  const end = cells
  const termRows = (end - start) / 2
  return { start, end, termRows }
}

/** Raster with square cell sampling — preserves geometry (no stretch). */
function paintFrame(frame: Frame, cells: number): StyledText {
  const rects = mascotRects(frame)
  const { start, termRows } = sampleWindow(cells)
  const chunks: TextChunk[] = []

  for (let tr = 0; tr < termRows; tr++) {
    const rTop = start + tr * 2
    const rBot = rTop + 1
    for (let c = 0; c < cells; c++) {
      const sx = ((c + 0.5) / cells) * CANVAS
      const syTop = ((rTop + 0.5) / cells) * CANVAS
      const syBot = ((rBot + 0.5) / cells) * CANVAS
      const top = colorOf(sample(rects, sx, syTop), syTop)
      const bot = colorOf(sample(rects, sx, syBot), syBot)
      if (!top && !bot) {
        chunks.push({ __isChunk: true, text: " ", attributes: 0 })
      } else {
        chunks.push({
          __isChunk: true,
          text: "▀",
          fg: top ?? VOID,
          bg: bot ?? VOID,
          attributes: 0,
        })
      }
    }
    if (tr < termRows ? 1) chunks.push({ __isChunk: true, text: "\n", attributes: 0 })
  }
  return new StyledText(chunks)
}

type FrameSet = Record<Frame, StyledText>
const frameCache = new Map<number, FrameSet>()

function framesFor(cells: number): FrameSet {
  let cached = frameCache.get(cells)
  if (cached) return cached
  cached = {
    0: paintFrame(0, cells),
    1: paintFrame(1, cells),
    2: paintFrame(2, cells),
    3: paintFrame(3, cells),
  }
  frameCache.set(cells, cached)
  return cached
}

function resolveCells(size?: MascotSize, cols?: number): number {
  if (size && size in SIZE_CELLS) return SIZE_CELLS[size]
  if (typeof cols === "number" && cols > 0) {
    const n = Math.max(12, Math.min(24, Math.round(cols)))
    return n % 2 === 0 ? n : n + 1
  }
  return SIZE_CELLS.sm
}

export type MascotMood = "idle" | "thinking" | "waiting" | "done" | "error"

export type ZavorthMascotProps = {
  mood?: MascotMood
  /** sm=16×7 · md=18×8 (home) · lg=20×9 */
  size?: MascotSize
  cols?: number
  rows?: number
}

const SEQUENCES: Record<MascotMood, Frame[]> = {
  idle: [0, 0, 1, 0, 0, 2, 0, 0, 3, 0],
  thinking: [0, 1, 0, 3, 1, 0, 3, 1, 0, 3],
  waiting: [0, 2, 2, 0, 2, 2, 2, 0, 2, 0],
  done: [0, 0, 0, 0, 0, 0, 0, 0, 2, 0],
  error: [0, 2, 1, 2, 0, 2, 3, 2, 0, 1],
}

const TICK_MS: Record<MascotMood, number> = {
  idle: 420,
  thinking: 220,
  waiting: 500,
  done: 560,
  error: 220,
}

export function ZavorthMascot(props: ZavorthMascotProps) {
  const mood = createMemo(() => props.mood ?? ("idle" as MascotMood))
  const cells = createMemo(() => resolveCells(props.size, props.cols))
  const dims = createMemo(() => {
    const c = cells()
    const { termRows } = sampleWindow(c)
    return { width: c, height: termRows }
  })
  const [step, setStep] = createSignal(0)
  let text: TextRenderable | undefined
  let timer: ReturnType<typeof setInterval> | undefined

  const sequence = createMemo(() => SEQUENCES[mood()] ?? SEQUENCES.idle)
  const tickMs = createMemo(() => TICK_MS[mood()] ?? TICK_MS.idle)
  const frames = createMemo(() => framesFor(cells()))

  const content = () => {
    const seq = sequence()
    const set = frames()
    return set[seq[step() % seq.length]!]
  }

  createEffect(() => {
    const ms = tickMs()
    void mood()
    setStep(0)
    if (timer) clearInterval(timer)
    timer = setInterval(() => setStep((s) => s + 1), ms)
  })

  onCleanup(() => {
    if (timer) clearInterval(timer)
  })

  createEffect(() => {
    if (text) text.content = content()
  })

  return (
    <box width={dims().width} height={dims().height} flexShrink={0}>
      <text
        ref={(r: TextRenderable) => {
          text = r
          r.content = content()
        }}
        width={dims().width}
        height={dims().height}
        wrapMode="none"
      />
    </box>
  )
}
