import type { BoxRenderable, TextareaRenderable, KeyEvent, ScrollBoxRenderable } from "@opentui/core"
import { TextAttributes } from "@opentui/core"
import { pathToFileURL } from "bun"
import fuzzysort from "fuzzysort"
import { firstBy } from "remeda"
import {
  createMemo,
  createResource,
  createEffect,
  onMount,
  onCleanup,
  Index,
  Show,
  createSignal,
  untrack,
} from "solid-js"
import { createStore } from "solid-js/store"
import { useSDK } from "@tui/context/sdk"
import { useSync } from "@tui/context/sync"
import { useLocal } from "@tui/context/local"
import { getScrollAcceleration } from "../../util/scroll"
import { useTuiConfig } from "../../context/tui-config"
import { useTheme } from "@tui/context/theme"
import { SplitBorder } from "@tui/component/border"
import { useCommandDialog } from "@tui/component/dialog-command"
import { useLanguage } from "@tui/context/language"
import { slashCommandDescription } from "@tui/i18n/slash-command"
import { useTerminalDimensions } from "@opentui/solid"
import { Locale } from "@/util"
import type { PromptInfo } from "./history"
import { useFrecency } from "./frecency"
import { detectTrigger } from "./autocomplete-detect"
import { charAfterCursor } from "./offset"
import { useKV } from "@tui/context/kv"
import { useToast } from "@tui/ui/toast"
import { shouldShow as firstTouchShouldShow, markSeen as firstTouchMarkSeen } from "../../util/first-touch"

function removeLineRange(input: string) {
  const hashIndex = input.lastIndexOf("#")
  return hashIndex !== -1 ? input.substring(0, hashIndex) : input
}

function extractLineRange(input: string) {
  const hashIndex = input.lastIndexOf("#")
  if (hashIndex === -1) {
    return { baseQuery: input }
  }

  const baseName = input.substring(0, hashIndex)
  const linePart = input.substring(hashIndex + 1)
  const lineMatch = linePart.match(/^(\d+)(?:-(\d*))...$/)

  if (!lineMatch) {
    return { baseQuery: baseName }
  }

  const startLine = Number(lineMatch[1])
  const endLine = lineMatch[2] && startLine < Number(lineMatch[2]) ? Number(lineMatch[2]) : undefined

  return {
    lineRange: {
      baseName,
      startLine,
      endLine,
    },
    baseQuery: baseName,
  }
}

export type AutocompleteRef = {
  onInput: (value: string) => void
  onKeyDown: (e: KeyEvent) => void
  visible: false | "@" | "$" | "/"
}

export type AutocompleteOption = {
  display: string
  value?: string
  aliases?: string[]
  disabled?: boolean
  description?: string
  isDirectory?: boolean
  kind?: "file" | "dir" | "mcp" | "agent" | "command" | "category"
  /** Left gutter / selection accent color (e.g. agent color). */
  accent?: any
  onSelect?: () => void
  path?: string
}

export function Autocomplete(props: {
  value: string
  sessionID?: string
  setPrompt: (input: (prompt: PromptInfo) => void) => void
  setExtmark: (partIndex: number, extmarkId: number) => void
  anchor: () => BoxRenderable
  input: () => TextareaRenderable
  ref: (ref: AutocompleteRef) => void
  fileStyleId: number
  agentStyleId: number
  promptPartTypeId: () => number
}) {
  const sdk = useSDK()
  const sync = useSync()
  const local = useLocal()
  const command = useCommandDialog()
  const lang = useLanguage()
  const t = lang.t
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const frecency = useFrecency()
  const tuiConfig = useTuiConfig()
  const kv = useKV()
  const toast = useToast()

  const [store, setStore] = createStore({
    index: 0,
    selected: 0,
    visible: false as AutocompleteRef["visible"],
    input: "keyboard" as "keyboard" | "mouse",
  })

  const [positionTick, setPositionTick] = createSignal(0)

  createEffect(() => {
    if (store.visible) {
      let lastPos = { x: 0, y: 0, width: 0 }
      const interval = setInterval(() => {
        const anchor = props.anchor()
        if (anchor.x !== lastPos.x || anchor.y !== lastPos.y || anchor.width !== lastPos.width) {
          lastPos = { x: anchor.x, y: anchor.y, width: anchor.width }
          setPositionTick((t) => t + 1)
        }
      }, 50)

      onCleanup(() => clearInterval(interval))
    }
  })

  const position = createMemo(() => {
    if (!store.visible) return { x: 0, y: 0, width: 0 }
    dimensions()
    positionTick()
    const anchor = props.anchor()
    const parent = anchor.parent
    const parentX = parent?.x ?? 0
    const parentY = parent?.y ?? 0

    return {
      x: anchor.x - parentX,
      y: anchor.y - parentY,
      width: anchor.width,
    }
  })

  const filter = createMemo(() => {
    if (!store.visible) return
    // Track props.value to make memo reactive to text changes
    props.value // <- there surely is a better way to do this, like making .input() reactive

    return props.input().getTextRange(store.index + 1, props.input().cursorOffset)
  })

  // filter() reads reactive props.value plus non-reactive cursor/text state.
  // On keypress those can be briefly out of sync, so filter() may return an empty/partial string.
  // Copy it into search in an effect because effects run after reactive updates have been rendered and painted
  // so the input has settled and all consumers read the same stable value.
  const [search, setSearch] = createSignal("")
  createEffect(() => {
    const next = filter()
    setSearch(next ? next : "")
  })

  // When the filter changes due to how TUI works, the mousemove might still be triggered
  // via a synthetic event as the layout moves underneath the cursor. This is a workaround to make sure the input mode remains keyboard so
  // that the mouseover event doesn't trigger when filtering.
  createEffect(() => {
    filter()
    setStore("input", "keyboard")
  })

  function insertPart(text: string, part: PromptInfo["parts"][number], prefix: "@" | "$" = "@") {
    const input = props.input()
    const currentCursorOffset = input.cursorOffset

    const needsSpace = charAfterCursor(props.value, currentCursorOffset) !== " "
    const append = prefix + text + (needsSpace ? " " : "")

    input.cursorOffset = store.index
    const startCursor = input.logicalCursor
    input.cursorOffset = currentCursorOffset
    const endCursor = input.logicalCursor

    input.deleteRange(startCursor.row, startCursor.col, endCursor.row, endCursor.col)
    input.insertText(append)

    const virtualText = prefix + text
    const extmarkStart = store.index
    const extmarkEnd = extmarkStart + Bun.stringWidth(virtualText)

    const styleId = part.type === "file" ? props.fileStyleId : part.type === "agent" ? props.agentStyleId : undefined

    const extmarkId = input.extmarks.create({
      start: extmarkStart,
      end: extmarkEnd,
      virtual: true,
      styleId,
      typeId: props.promptPartTypeId(),
    })

    props.setPrompt((draft) => {
      if (part.type === "file") {
        const existingIndex = draft.parts.findIndex((p) => p.type === "file" && "url" in p && p.url === part.url)
        if (existingIndex !== -1) {
          const existing = draft.parts[existingIndex]
          if (
            part.source?.text &&
            existing &&
            "source" in existing &&
            existing.source &&
            "text" in existing.source &&
            existing.source.text
          ) {
            existing.source.text.start = extmarkStart
            existing.source.text.end = extmarkEnd
            existing.source.text.value = virtualText
          }
          return
        }
      }

      if (part.type === "file" && part.source?.text) {
        part.source.text.start = extmarkStart
        part.source.text.end = extmarkEnd
        part.source.text.value = virtualText
      } else if (part.type === "agent" && part.source) {
        part.source.start = extmarkStart
        part.source.end = extmarkEnd
        part.source.value = virtualText
      }
      const partIndex = draft.parts.length
      draft.parts.push(part)
      props.setExtmark(partIndex, extmarkId)
    })

    if (part.type === "file" && part.source && part.source.type === "file") {
      frecency.updateFrecency(part.source.path)
    }
  }

  const [files] = createResource(
    () => search(),
    async (query) => {
      if (store.visible !== "@") return []

      const { lineRange, baseQuery } = extractLineRange(query ?? "")

      // Get files from SDK
      const result = await sdk.client.find.files({
        query: baseQuery,
      })

      const options: AutocompleteOption[] = []

      // Add file options
      if (!result.error && result.data) {
        const sortedFiles = result.data.sort((a, b) => {
          const aScore = frecency.getFrecency(a)
          const bScore = frecency.getFrecency(b)
          if (aScore !== bScore) return bScore - aScore
          const aDepth = a.split("/").length
          const bDepth = b.split("/").length
          if (aDepth !== bDepth) return aDepth ? bDepth
          return a.localeCompare(b)
        })

        const width = Math.max(8, props.anchor().width - 6)
        options.push(
          ...sortedFiles.map((item): AutocompleteOption => {
            const baseDir = (sync.path.directory || process.cwd()).replace(/\/+$/, "")
            const fullPath = `${baseDir}/${item}`
            const urlObj = pathToFileURL(fullPath)
            let filename = item
            if (lineRange && !item.endsWith("/")) {
              filename = `${item}#${lineRange.startLine}${lineRange.endLine ? `-${lineRange.endLine}` : ""}`
              urlObj.searchParams.set("start", String(lineRange.startLine))
              if (lineRange.endLine !== undefined) {
                urlObj.searchParams.set("end", String(lineRange.endLine))
              }
            }
            const url = urlObj.href

            const isDir = item.endsWith("/")
            const marker = isDir ? "▸ " : "· "
            return {
              display: marker + Locale.truncateMiddle(filename, Math.max(4, width - 2)),
              value: filename,
              isDirectory: isDir,
              kind: isDir ? "dir" : "file",
              path: item,
              onSelect: () => {
                insertPart(filename, {
                  type: "file",
                  mime: "text/plain",
                  filename,
                  url,
                  source: {
                    type: "file",
                    text: {
                      start: 0,
                      end: 0,
                      value: "",
                    },
                    path: item,
                  },
                })
              },
            }
          }),
        )
      }

      return options
    },
    {
      initialValue: [],
    },
  )

  const mcpResources = createMemo(() => {
    if (store.visible !== "@") return []

    const options: AutocompleteOption[] = []
    const width = Math.max(8, props.anchor().width - 6)

    for (const res of Object.values(sync.data.mcp_resource)) {
      const text = `${res.name} (${res.uri})`
      options.push({
        display: Locale.truncateMiddle(text, width),
        value: text,
        description: res.description,
        kind: "mcp",
        onSelect: () => {
          insertPart(res.name, {
            type: "file",
            mime: res.mimeType ?? "text/plain",
            filename: res.name,
            url: res.uri,
            source: {
              type: "resource",
              text: {
                start: 0,
                end: 0,
                value: "",
              },
              clientName: res.client,
              uri: res.uri,
            },
          })
        },
      })
    }

    return options
  })

  const agents = createMemo(() => {
    const list = sync.data.agent
    return list
      .filter((agent) => !agent.hidden && agent.mode !== "primary")
      .map((agent): AutocompleteOption => {
        const mode =
          agent.mode === "subagent"
            ? t("tui.agent.mode.subagent")
            : agent.mode === "all"
              ? t("tui.agent.mode.all")
              : agent.mode
        const desc = agent.description
          ? Locale.truncate(agent.description, 36)
          : mode
        return {
          // Display without $ prefix — chrome is Zavorth, insert still uses $
          display: agent.name,
          value: agent.name,
          description: desc,
          kind: "agent",
          accent: local.agent.color(agent.name),
          onSelect: () => {
            insertPart(
              agent.name,
              {
                type: "agent",
                name: agent.name,
                source: {
                  start: 0,
                  end: 0,
                  value: "",
                },
              },
              "$",
            )
          },
        }
      })
  })

  const commands = createMemo((): AutocompleteOption[] => {
    const results: AutocompleteOption[] = command.slashes().map((item) => ({
      ...item,
      kind: "command" as const,
    }))

    for (const serverCommand of sync.data.command) {
      if (serverCommand.source === "skill") continue
      const label = serverCommand.source === "mcp" ? ":mcp" : ""
      results.push({
        display: "/" + serverCommand.name + label,
        description: slashCommandDescription(lang.t, serverCommand.name, serverCommand.description),
        kind: "command",
        onSelect: () => {
          const newText = "/" + serverCommand.name + " "
          const cursor = props.input().logicalCursor
          props.input().deleteRange(0, 0, cursor.row, cursor.col)
          props.input().insertText(newText)
          props.input().cursorOffset = Bun.stringWidth(newText)
        },
      })
    }

    results.sort((a, b) => a.display.localeCompare(b.display))

    const max = firstBy(results, [(x) => x.display.length, "desc"])?.display.length
    if (!max) return results
    return results.map((item) => ({
      ...item,
      display: item.display.padEnd(max + 2),
    }))
  })

  const options = createMemo((prev: AutocompleteOption[] | undefined) => {
    const filesValue = files()
    const agentsValue = agents()
    const commandsValue = commands()
    const mcpValue = mcpResources()

    let mixed: AutocompleteOption[]
    if (store.visible === "@") {
      const fileOpts = filesValue || []
      if (fileOpts.length > 0 && mcpValue.length > 0) {
        mixed = [
          ...fileOpts,
          { display: "MCP", disabled: true, kind: "category" },
          ...mcpValue,
        ]
      } else {
        mixed = [...fileOpts, ...mcpValue]
      }
    } else if (store.visible === "$") {
      mixed = [...agentsValue]
    } else {
      mixed = [...commandsValue]
    }

    const searchValue = search()

    if (!searchValue) {
      return mixed
    }

    if (files.loading && prev && prev.length > 0) {
      return prev
    }

    // Category headers are not searchable; re-insert MCP section when both sides remain.
    const searchable = mixed.filter((item) => item.kind !== "category")
    const result = fuzzysort.go(removeLineRange(searchValue), searchable, {
      keys: [
        (obj) => removeLineRange((obj.value ?? obj.display).trimEnd()),
        "description",
        (obj) => obj.aliases?.join(" ") ?? "",
      ],
      limit: 10,
      scoreFn: (objResults) => {
        const displayResult = objResults[0]
        let score = objResults.score
        const target = displayResult?.target ?? ""
        // Boost exact prefix matches for trigger+query and bare name (agents drop `$` in display).
        if (target.startsWith(store.visible + searchValue) || target.startsWith(searchValue)) {
          score *= 2
        }
        const frecencyScore = objResults.obj.path ? frecency.getFrecency(objResults.obj.path) : 0
        return score * (1 + frecencyScore)
      },
    })

    const ranked = result.map((arr) => arr.obj)
    if (store.visible !== "@") return ranked

    const filesRanked = ranked.filter((item) => item.kind !== "mcp")
    const mcpRanked = ranked.filter((item) => item.kind === "mcp")
    if (filesRanked.length > 0 && mcpRanked.length > 0) {
      return [...filesRanked, { display: "MCP", disabled: true, kind: "category" as const }, ...mcpRanked]
    }
    return ranked
  })

  function firstSelectableIndex(list: AutocompleteOption[]) {
    const idx = list.findIndex((item) => !item.disabled)
    return idx === -1 ? 0 : idx
  }

  createEffect(() => {
    filter()
    // Only re-home selection when the query changes — not on every options recompute.
    setStore(
      "selected",
      firstSelectableIndex(untrack(() => options())),
    )
  })

  function move(direction: -1 | 1) {
    if (!store.visible) return
    const list = options()
    if (!list.length) return
    let next = store.selected
    for (let i = 0; i < list.length; i++) {
      next += direction
      if (next < 0) next = list.length ? 1
      if (next >= list.length) next = 0
      if (!list[next]?.disabled) break
    }
    moveTo(next)
  }

  function moveTo(next: number) {
    setStore("selected", next)
    if (!scroll) return
    const viewportHeight = Math.min(height(), options().length)
    const scrollBottom = scroll.scrollTop + viewportHeight
    if (next < scroll.scrollTop) {
      scroll.scrollBy(next - scroll.scrollTop)
    } else if (next + 1 > scrollBottom) {
      scroll.scrollBy(next + 1 - scrollBottom)
    }
  }

  function select() {
    const selected = options()[store.selected]
    if (!selected || selected.disabled) return
    hide()
    selected.onSelect?.()
  }

  function expandDirectory() {
    const selected = options()[store.selected]
    if (!selected || !selected.isDirectory) return

    const input = props.input()
    const currentCursorOffset = input.cursorOffset

    // Prefer raw path/value — display may include markers / middle-truncation.
    const raw = (selected.value ?? selected.path ?? selected.display).trimEnd()
    const path = raw.startsWith("@") ? raw.slice(1) : raw

    input.cursorOffset = store.index
    const startCursor = input.logicalCursor
    input.cursorOffset = currentCursorOffset
    const endCursor = input.logicalCursor

    input.deleteRange(startCursor.row, startCursor.col, endCursor.row, endCursor.col)
    input.insertText("@" + path)

    setStore("selected", firstSelectableIndex(untrack(() => options())))
  }

  function show(mode: "@" | "$" | "/") {
    command.keybinds(false)
    setStore({
      visible: mode,
      index: props.input().cursorOffset,
    })

    // One-time tips when autocomplete first opens for @ / $
    if (mode === "@" && firstTouchShouldShow(kv, "file_mention")) {
      firstTouchMarkSeen(kv, "file_mention")
      toast.show({
        variant: "info",
        message: t("tui.tip.file_mention"),
        duration: 3500,
      })
    }
    if (mode === "$" && firstTouchShouldShow(kv, "agent_mention")) {
      firstTouchMarkSeen(kv, "agent_mention")
      toast.show({
        variant: "info",
        message: t("tui.tip.agent_mention"),
        duration: 3500,
      })
    }
  }

  function hide() {
    const text = props.input().plainText
    if (store.visible === "/" && !text.endsWith(" ") && text.startsWith("/")) {
      const cursor = props.input().logicalCursor
      props.input().deleteRange(0, 0, cursor.row, cursor.col)
      // Sync the prompt store immediately since onContentChange is async
      props.setPrompt((draft) => {
        draft.input = props.input().plainText
      })
    }
    command.keybinds(true)
    setStore("visible", false)
  }

  onMount(() => {
    props.ref({
      get visible() {
        return store.visible
      },
      onInput(value) {
        if (store.visible) {
          if (
            // Typed text before the trigger
            props.input().cursorOffset <= store.index ||
            // There is a space between the trigger and the cursor
            props.input().getTextRange(store.index, props.input().cursorOffset).match(/\s/) ||
            // "/<command>" is not the sole content
            (store.visible === "/" && value.match(/^\S+\s+\S+\s*$/))
          ) {
            hide()
          }
          return
        }

        // Check if autocomplete should reopen (e.g., after backspace deleted a space).
        // detectTrigger works in width coordinates so CJK before/after the trigger stays correct.
        const trigger = detectTrigger(value, props.input().cursorOffset)
        if (!trigger) return
        show(trigger.kind)
        setStore("index", trigger.index)
      },
      onKeyDown(e: KeyEvent) {
        if (store.visible) {
          const name = e.name?.toLowerCase()
          const ctrlOnly = e.ctrl && !e.meta && !e.shift
          const isNavUp = name === "up" || (ctrlOnly && name === "p")
          const isNavDown = name === "down" || (ctrlOnly && name === "n")

          if (isNavUp) {
            setStore("input", "keyboard")
            move(-1)
            e.preventDefault()
            return
          }
          if (isNavDown) {
            setStore("input", "keyboard")
            move(1)
            e.preventDefault()
            return
          }
          if (name === "escape") {
            hide()
            e.preventDefault()
            return
          }
          if (name === "return") {
            select()
            e.preventDefault()
            return
          }
          if (name === "tab") {
            const selected = options()[store.selected]
            if (selected?.isDirectory) {
              expandDirectory()
            } else {
              select()
            }
            e.preventDefault()
            return
          }
        }
        if (!store.visible) {
          if (e.name === "@" || e.name === "$") {
            const cursorOffset = props.input().cursorOffset
            const charBeforeCursor =
              cursorOffset === 0 ? undefined : props.input().getTextRange(cursorOffset ? 1, cursorOffset)
            const canTrigger = charBeforeCursor === undefined || charBeforeCursor === "" || /\s/.test(charBeforeCursor)
            if (canTrigger) show(e.name)
          }

          if (e.name === "/") {
            if (props.input().cursorOffset === 0) show("/")
          }
        }
      },
    })
  })

  const height = createMemo(() => {
    const count = options().length || 1
    if (!store.visible) return Math.min(10, count)
    positionTick()
    // Reserve one row for the mode header above the list.
    return Math.min(10, count, Math.max(1, props.anchor().y - 1))
  })

  // Agent summon panel uses a 2-line header (title + rule)
  const headerHeight = createMemo(() => (store.visible === "$" ? 2 : 1))

  const modeChrome = createMemo(() => {
    const mode = store.visible
    if (mode === "@") {
      return {
        mark: "◇",
        title: t("tui.autocomplete.files_title"),
        hint: t("tui.autocomplete.files_hint"),
        border: theme.borderSubtle ?? theme.border,
        isAgent: false,
      }
    }
    if (mode === "$") {
      return {
        mark: "◆",
        title: t("tui.autocomplete.agents_title"),
        hint: t("tui.autocomplete.agents_hint"),
        border: theme.primary,
        isAgent: true,
      }
    }
    return {
      mark: "◇",
      title: t("tui.autocomplete.commands_title"),
      hint: "",
      border: theme.border,
      isAgent: false,
    }
  })

  const emptyLabel = createMemo(() => {
    if (store.visible === "$") return t("tui.autocomplete.no_agents")
    return t("tui.autocomplete.no_results")
  })

  const agentCount = createMemo(() => {
    if (store.visible !== "$") return ""
    const n = options().filter((o) => !o.disabled).length
    if (n === 0) return ""
    return t("tui.autocomplete.agents_count", { count: n })
  })

  let scroll: ScrollBoxRenderable
  const scrollAcceleration = createMemo(() => getScrollAcceleration(tuiConfig))

  return (
    <box
      visible={store.visible !== false}
      position="absolute"
      top={position().y - height() - headerHeight()}
      left={position().x}
      width={position().width}
      zIndex={100}
      {...SplitBorder}
      borderColor={modeChrome().border}
    >
      {/* Mode header — distinct for $ summon vs file/command */}
      <Show
        when={modeChrome().isAgent}
        fallback={
          <box
            flexDirection="row"
            justifyContent="space-between"
            paddingLeft={1}
            paddingRight={1}
            backgroundColor={theme.backgroundMenu}
            flexShrink={0}
          >
            <text>
              <span style={{ fg: theme.primary, bold: true }}>{modeChrome().mark} </span>
              <span style={{ fg: theme.text, bold: true }}>{modeChrome().title}</span>
            </text>
            <Show when={modeChrome().hint}>
              <text fg={theme.textMuted}>{modeChrome().hint}</text>
            </Show>
          </box>
        }
      >
        <box
          flexDirection="column"
          gap={0}
          paddingLeft={1}
          paddingRight={1}
          backgroundColor={theme.backgroundElement}
          flexShrink={0}
        >
          <box flexDirection="row" justifyContent="space-between">
            <text>
              <span style={{ fg: theme.primary, bold: true }}>◆ </span>
              <span style={{ fg: theme.text, bold: true }}>{modeChrome().title}</span>
              <Show when={agentCount()}>
                <span style={{ fg: theme.textMuted }}> · {agentCount()}</span>
              </Show>
            </text>
            <text fg={theme.textMuted}>{modeChrome().hint}</text>
          </box>
          <text fg={theme.borderSubtle}>{"─".repeat(Math.min(40, Math.max(12, position().width - 4)))}</text>
        </box>
      </Show>

      <scrollbox
        ref={(r: ScrollBoxRenderable) => (scroll = r)}
        backgroundColor={theme.backgroundMenu}
        height={height()}
        scrollbarOptions={{ visible: false }}
        scrollAcceleration={scrollAcceleration()}
      >
        <Index
          each={options()}
          fallback={
            <box paddingLeft={1} paddingRight={1}>
              <text fg={theme.textMuted}>{emptyLabel()}</text>
            </box>
          }
        >
          {(option, index) => {
            const active = () => index === store.selected && !option().disabled
            const isCategory = () => option().kind === "category" || option().disabled
            const isAgent = () => option().kind === "agent"
            return (
              <box
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={active() ? theme.backgroundElement : undefined}
                flexDirection="row"
                gap={1}
                onMouseMove={() => {
                  if (option().disabled) return
                  setStore("input", "mouse")
                }}
                onMouseOver={() => {
                  if (option().disabled) return
                  if (store.input !== "mouse") return
                  moveTo(index)
                }}
                onMouseDown={() => {
                  if (option().disabled) return
                  setStore("input", "mouse")
                  moveTo(index)
                }}
                onMouseUp={() => {
                  if (option().disabled) return
                  select()
                }}
              >
                <Show
                  when={!isCategory()}
                  fallback={
                    <box flexGrow={1}>
                      <text fg={theme.primary} attributes={TextAttributes.BOLD}>
                        · {option().display}
                      </text>
                    </box>
                  }
                >
                  <Show
                    when={isAgent()}
                    fallback={
                      <>
                        <text flexShrink={0} fg={active() ? theme.primary : theme.textMuted}>
                          {active() ? "▸" : option().isDirectory ? "▸" : "·"}
                        </text>
                        <text
                          fg={theme.text}
                          attributes={active() ? TextAttributes.BOLD : undefined}
                          flexShrink={0}
                        >
                          {option().display}
                        </text>
                        <Show when={option().description}>
                          <text fg={theme.textMuted} wrapMode="none">
                            {" "}
                            {option().description}
                          </text>
                        </Show>
                      </>
                    }
                  >
                    {/* Agent summon row — diamond + name + muted role (not OpenCode $name list) */}
                    <text flexShrink={0} fg={active() ? theme.primary : option().accent ?? theme.textMuted}>
                      {active() ? "▸" : " "}
                    </text>
                    <text flexShrink={0} fg={option().accent ?? theme.primary}>
                      ◆
                    </text>
                    <text
                      fg={theme.text}
                      attributes={active() ? TextAttributes.BOLD : undefined}
                      flexShrink={0}
                    >
                      {option().display}
                    </text>
                    <Show when={option().description}>
                      <text fg={theme.textMuted} wrapMode="none">
                        {"  ·  "}
                        {option().description}
                      </text>
                    </Show>
                  </Show>
                </Show>
              </box>
            )
          }}
        </Index>
      </scrollbox>
    </box>
  )
}
