import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import type { BoxRenderable, TextRenderable } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { BLACK, renderOperationalMeshBackground } from "./starry-background-renderer"

export { renderOperationalMeshBackground } from "./starry-background-renderer"

export function StarryBackground() {
  const { theme } = useTheme()
  const [size, setSize] = createSignal({ w: 80, h: 24 })
  const [phase, setPhase] = createSignal(0)
  let timer: ReturnType<typeof setInterval> | undefined
  let box: BoxRenderable | undefined
  let text: TextRenderable | undefined

  const sync = () => {
    if (!box) return
    const next = { w: box.width || 80, h: box.height || 24 }
    const cur = size()
    if (next.w === cur.w && next.h === cur.h) return
    setSize(next)
  }

  onMount(() => {
    sync()
    box?.on("resize", sync)
    timer = setInterval(() => setPhase((n) => n + 1), 180)
  })

  onCleanup(() => {
    box?.off("resize", sync)
    if (timer) clearInterval(timer)
  })

  const content = createMemo(() => {
    const { w, h } = size()
    return renderOperationalMeshBackground({ w, h, theme, phase: phase() }).styled
  })

  createEffect(() => {
    if (!text) return
    text.content = content()
  })

  return (
    <box
      ref={(item: BoxRenderable) => (box = item)}
      position="absolute"
      top={0}
      left={0}
      width="100%"
      height="100%"
      zIndex={0}
      backgroundColor={BLACK}
    >
      <text
        ref={(item: TextRenderable) => {
          text = item
          item.content = content()
        }}
        width="100%"
        height="100%"
        wrapMode="none"
        selectable={false}
      />
    </box>
  )
}
