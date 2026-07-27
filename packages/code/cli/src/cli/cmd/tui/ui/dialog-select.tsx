import { InputRenderable, RGBA, ScrollBoxRenderable, TextAttributes } from "@opentui/core"
import { useTheme } from "@tui/context/theme"
import { entries, filter, flatMap, groupBy, pipe } from "remeda"
import { batch, createEffect, createMemo, For, Show, type JSX, on } from "solid-js"
import { createStore } from "solid-js/store"
import { useKeyboard, useTerminalDimensions } from "@opentui/solid"
import * as fuzzysort from "fuzzysort"
import { isDeepEqual } from "remeda"
import { useDialog, type DialogContext } from "@tui/ui/dialog"
import { Keybind } from "@/util"
import { Locale } from "@/util"
import { getScrollAcceleration } from "../util/scroll"
import { pinyinSearch } from "../util/pinyin"
import { useTuiConfig } from "../context/tui-config"
import { useLanguage } from "@tui/context/language"

export interface DialogSelectProps<T> {
  title: string
  placeholder?: string
  options: DialogSelectOption<T>[]
  flat?: boolean
  ref?: (ref: DialogSelectRef<T>) => void
  onMove?: (option: DialogSelectOption<T>) => void
  onFilter?: (query: string) => void
  onSelect?: (option: DialogSelectOption<T>) => void
  skipFilter?: boolean
  keybind?: {
    keybind?: Keybind.Info
    title: string
    side?: "left" | "right"
    disabled?: boolean
    onTrigger: (option: DialogSelectOption<T>) => void
  }[]
  current?: T
  /** Optional muted subtitle shown under the title (e.g. a usage hint). */
  hint?: string
}

export interface DialogSelectOption<T = any> {
  title: string
  value: T
  description?: string
  footer?: JSX.Element | string
  category?: string
  /** Extra latin search terms (e.g. English keywords) so the item is findable without switching input method. */
  keywords?: string[]
  categoryView?: JSX.Element
  disabled?: boolean
  bg?: RGBA
  gutter?: JSX.Element
  margin?: JSX.Element
  onSelect?: (ctx: DialogContext) => void
}

export type DialogSelectRef<T> = {
  filter: string
  filtered: DialogSelectOption<T>[]
}

/**
 * Zavorth select — branded command/list chrome (not OpenCode plain list).
 * Soft selection, diamond mark, section rails, no solid color slabs.
 */
export function DialogSelect<T>(props: DialogSelectProps<T>) {
  const dialog = useDialog()
  const tuiConfig = useTuiConfig()
  const t = useLanguage().t
  const { theme } = useTheme()
  const scrollAcceleration = createMemo(() => getScrollAcceleration(tuiConfig))

  const [store, setStore] = createStore({
    selected: 0,
    filter: "",
    input: "keyboard" as "keyboard" | "mouse",
  })

  createEffect(
    on(
      () => props.current,
      (current) => {
        if (current) {
          const currentIndex = flat().findIndex((opt) => isDeepEqual(opt.value, current))
          if (currentIndex >= 0) {
            setStore("selected", currentIndex)
          }
        }
      },
    ),
  )

  let input: InputRenderable
  let scroll: ScrollBoxRenderable

  const filtered = createMemo(() => {
    if (props.skipFilter) return props.options.filter((x) => x.disabled !== true)
    const needle = store.filter.toLowerCase()
    const options = pipe(
      props.options,
      filter((x) => x.disabled !== true),
    )
    if (!needle) return options

    const result = fuzzysort
      .go(needle, options, {
        keys: [
          "title",
          "category",
          (o) => o.keywords?.join(" ") ?? "",
          (o) => pinyinSearch(o.title),
        ],
        scoreFn: (r) => r[0].score * 2 + r[1].score + r[2].score * 2 + r[3].score,
      })
      .map((x) => x.obj)

    return result
  })

  createEffect(
    on(
      () => store.filter,
      () => {
        setStore("input", "keyboard")
        setStore("selected", 0)
      },
    ),
  )

  const grouped = createMemo(() => {
    if (props.flat) {
      return [["", filtered()]] as [string, DialogSelectOption<T>[]][]
    }
    return pipe(
      filtered(),
      groupBy((x) => x.category ?? ""),
      entries(),
    ) as [string, DialogSelectOption<T>[]][]
  })

  const flat = createMemo(() => flatMap(grouped(), ([, options]) => options))

  createEffect(() => {
    props.ref?.({
      get filter() {
        return store.filter
      },
      get filtered() {
        return filtered()
      },
    })
  })

  function moveTo(index: number) {
    const list = flat()
    if (list.length === 0) return
    const next = Math.max(0, Math.min(index, list.length - 1))
    setStore("selected", next)
    const opt = list[next]
    if (opt) props.onMove?.(opt)
    if (scroll) {
      const child = scroll.getChildren().find((c) => c.id === String(next))
      if (child) scroll.scrollBy(child.y - scroll.y - Math.floor(scroll.height / 2))
    }
  }

  useKeyboard((evt) => {
    if (evt.defaultPrevented) return
    if (store.input === "mouse") setStore("input", "keyboard")

    if (evt.name === "up" || (evt.ctrl && evt.name === "p")) {
      evt.preventDefault()
      moveTo(store.selected ? 1)
      return
    }
    if (evt.name === "down" || (evt.ctrl && evt.name === "n")) {
      evt.preventDefault()
      moveTo(store.selected + 1)
      return
    }
    if (evt.name === "return") {
      evt.preventDefault()
      const option = flat()[store.selected]
      if (!option || option.disabled) return
      option.onSelect?.(dialog)
      props.onSelect?.(option)
      return
    }

    for (const item of props.keybind ?? []) {
      if (item.disabled || !item.keybind) continue
      if (Keybind.match(item.keybind, Keybind.fromParsedKey(evt))) {
        evt.preventDefault()
        const option = flat()[store.selected]
        if (option) item.onTrigger(option)
      }
    }
  })

  const dimensions = useTerminalDimensions()
  const height = createMemo(() => Math.min(12, Math.max(5, Math.floor(dimensions().height / 3.5))))

  const keybinds = createMemo(() => props.keybind?.filter((x) => !x.disabled && x.keybind) ?? [])
  const left = createMemo(() => keybinds().filter((item) => item.side !== "right"))
  const right = createMemo(() => keybinds().filter((item) => item.side === "right"))
  const countLabel = createMemo(() => {
    const n = flat().length
    if (n === 0) return ""
    return n === 1 ? "1" : String(n)
  })

  return (
    <box gap={0} paddingBottom={1} paddingTop={0}>
      {/* Brand header — diamond + title (not OpenCode plain bold) */}
      <box paddingLeft={2} paddingRight={2} paddingTop={0} paddingBottom={0} gap={0}>
        <box flexDirection="row" justifyContent="space-between" alignItems="center">
          <text>
            <span style={{ fg: theme.primary, bold: true }}>◆ </span>
            <span style={{ fg: theme.text, bold: true }}>{props.title}</span>
            <Show when={countLabel()}>
              <span style={{ fg: theme.textMuted }}> · {countLabel()}</span>
            </Show>
          </text>
          <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
            {t("tui.dialog.close_hint")}
          </text>
        </box>
        <Show when={props.hint}>
          <text fg={theme.textMuted}>{props.hint}</text>
        </Show>
        <text fg={theme.borderSubtle}>{"─".repeat(Math.min(48, Math.max(20, dimensions().width - 20)))}</text>
      </box>

      {/* Search rail with left accent */}
      <Show when={!props.skipFilter}>
        <box
          marginLeft={2}
          marginRight={2}
          marginTop={0}
          marginBottom={0}
          paddingLeft={1}
          paddingRight={1}
          flexDirection="row"
          gap={1}
          border={["left"]}
          borderColor={theme.primary}
          backgroundColor={theme.backgroundElement}
        >
          <text fg={theme.primary} flexShrink={0}>
            ▸
          </text>
          <input
            flexGrow={1}
            onInput={(e) => {
              batch(() => {
                setStore("filter", e)
                props.onFilter?.(e)
              })
            }}
            focusedBackgroundColor={theme.backgroundElement}
            cursorColor={theme.primary}
            focusedTextColor={theme.text}
            ref={(r) => {
              input = r
              input.traits = { status: "FILTER" }
              setTimeout(() => {
                if (!input) return
                if (input.isDestroyed) return
                input.focus()
              }, 1)
            }}
            placeholder={props.placeholder ?? t("tui.dialog.select.placeholder")}
            placeholderColor={theme.textMuted}
          />
        </box>
      </Show>

      <Show
        when={grouped().length > 0}
        fallback={
          <box paddingLeft={3} paddingRight={2} paddingTop={1}>
            <text fg={theme.textMuted}>{t("tui.dialog.select.no_results")}</text>
          </box>
        }
      >
        <scrollbox
          paddingLeft={1}
          paddingRight={1}
          marginTop={1}
          scrollbarOptions={{ visible: false }}
          scrollAcceleration={scrollAcceleration()}
          ref={(r: ScrollBoxRenderable) => (scroll = r)}
          maxHeight={height()}
        >
          <For each={grouped()}>
            {([category, options], index) => (
              <>
                <Show when={category}>
                  <box paddingTop={index() > 0 ? 1 : 0} paddingLeft={2}>
                    <Show
                      when={options[0]?.categoryView}
                      fallback={
                        <text fg={theme.primary}>
                          <span style={{ bold: true }}>· {category}</span>
                        </text>
                      }
                    >
                      {options[0]?.categoryView}
                    </Show>
                  </box>
                </Show>
                <For each={options}>
                  {(option) => {
                    const rowIndex = createMemo(() => flat().indexOf(option))
                    const active = createMemo(() => rowIndex() === store.selected)
                    const current = createMemo(() => isDeepEqual(option.value, props.current))
                    return (
                      <box
                        id={String(rowIndex())}
                        flexDirection="row"
                        position="relative"
                        onMouseMove={() => {
                          setStore("input", "mouse")
                        }}
                        onMouseUp={() => {
                          option.onSelect?.(dialog)
                          props.onSelect?.(option)
                        }}
                        onMouseOver={() => {
                          if (store.input !== "mouse") return
                          if (rowIndex() === -1) return
                          moveTo(rowIndex())
                        }}
                        onMouseDown={() => {
                          if (rowIndex() === -1) return
                          moveTo(rowIndex())
                        }}
                        backgroundColor={active() ? theme.backgroundElement : RGBA.fromInts(0, 0, 0, 0)}
                        paddingLeft={1}
                        paddingRight={2}
                        gap={1}
                      >
                        <Option
                          title={option.title}
                          footer={props.flat ? (option.category ?? option.footer) : option.footer}
                          description={option.description !== category ? option.description : undefined}
                          active={active()}
                          current={current()}
                          gutter={option.gutter}
                        />
                      </box>
                    )
                  }}
                </For>
              </>
            )}
          </For>
        </scrollbox>
      </Show>

      <Show when={keybinds().length} fallback={<box flexShrink={0} />}>
        <box
          paddingRight={2}
          paddingLeft={2}
          flexDirection="row"
          justifyContent="space-between"
          flexShrink={0}
          paddingTop={1}
        >
          <box flexDirection="row" gap={2}>
            <For each={left()}>
              {(item) => (
                <text fg={theme.textMuted}>
                  <span style={{ fg: theme.primary }}>{Keybind.toString(item.keybind)}</span>
                  {" "}
                  {item.title}
                </text>
              )}
            </For>
          </box>
          <box flexDirection="row" gap={2}>
            <For each={right()}>
              {(item) => (
                <text fg={theme.textMuted}>
                  <span style={{ fg: theme.primary }}>{Keybind.toString(item.keybind)}</span>
                  {" "}
                  {item.title}
                </text>
              )}
            </For>
          </box>
        </box>
      </Show>
    </box>
  )
}

function Option(props: {
  title: string
  description?: string
  active?: boolean
  current?: boolean
  footer?: JSX.Element | string
  gutter?: JSX.Element
  onMouseOver?: () => void
}) {
  const { theme } = useTheme()

  const mark = () => {
    if (props.active) return "▸"
    if (props.current) return "◆"
    return "·"
  }
  const markFg = () => {
    if (props.active) return theme.primary
    if (props.current) return theme.primary
    return theme.textMuted
  }

  return (
    <>
      <text flexShrink={0} fg={markFg()}>
        {mark()}
      </text>
      <Show when={props.gutter && !props.current}>
        <box flexShrink={0}>{props.gutter}</box>
      </Show>
      <text
        flexGrow={1}
        fg={props.active ? theme.text : theme.text}
        attributes={props.active ? TextAttributes.BOLD : undefined}
        overflow="hidden"
        wrapMode="none"
      >
        {Locale.truncate(props.title, 48)}
        <Show when={props.description}>
          <span style={{ fg: theme.textMuted }}>
            {"  "}
            {Locale.truncate(String(props.description), 28)}
          </span>
        </Show>
      </text>
      <Show when={props.footer}>
        <box flexShrink={0}>
          <text fg={props.active ? theme.primary : theme.textMuted}>{props.footer}</text>
        </box>
      </Show>
    </>
  )
}
