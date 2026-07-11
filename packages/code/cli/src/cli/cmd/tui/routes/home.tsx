import { Prompt, type PromptRef } from "@tui/component/prompt"
import { createEffect, createMemo, createSignal, Show } from "solid-js"
import path from "path"
import { WelcomeBox } from "./WelcomeBox"
import { BackgroundImage } from "../component/background-image"
import { useProject } from "../context/project"
import { useSync } from "../context/sync"
import { Toast } from "../ui/toast"
import { useArgs } from "../context/args"
import { useRouteData } from "@tui/context/route"
import { usePromptRef } from "../context/prompt"
import { useLocal } from "../context/local"
import { useKV } from "../context/kv"
import { useLanguage } from "@tui/context/language"
import { TuiPluginRuntime } from "../plugin"
import { Global } from "@/global"
import { isPlainTerminal } from "../util/terminal"

let once = false

export function Home() {
  const sync = useSync()
  const project = useProject()
  const route = useRouteData("home")
  const promptRef = usePromptRef()
  const [ref, setRef] = createSignal<PromptRef | undefined>()
  const args = useArgs()
  const local = useLocal()
  const kv = useKV()
  const t = useLanguage().t
  const plainTerminal = isPlainTerminal()
  const bgImagePath = createMemo(() => {
    const filename = kv.get("background_image")
    if (!filename || typeof filename !== "string") return undefined
    return path.join(Global.Path.config, "backgrounds", filename)
  })
  const placeholder = {
    get normal() {
      return [
        t("tui.home.placeholder.example.todo"),
        t("tui.home.placeholder.example.stack"),
        t("tui.home.placeholder.example.tests"),
      ]
    },
    shell: ["ls -la", "git status", "pwd"],
  }
  let sent = false

  const bind = (r: PromptRef | undefined) => {
    setRef(r)
    promptRef.set(r)
    if (once || !r) return
    if (route.prompt) {
      r.set(route.prompt)
      once = true
      return
    }
    if (!args.prompt) return
    r.set({ input: args.prompt, parts: [] })
    once = true
  }

  createEffect(() => {
    const r = ref()
    if (sent) return
    if (!r) return
    if (!sync.ready || !local.model.ready) return
    if (!args.prompt) return
    if (r.current.input !== args.prompt) return
    sent = true
    r.submit()
  })

  return (
    <>
      <Show when={!plainTerminal}>
        <Show when={bgImagePath()}>
          {(p) => <BackgroundImage path={p()} />}
        </Show>
      </Show>

      <box
        flexGrow={1}
        flexDirection="column"
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={0}
        zIndex={1}
        backgroundColor="transparent"
      >
        <WelcomeBox />
        <TuiPluginRuntime.Slot name="home_bottom" mode="single_winner" />

        <box flexGrow={1} minHeight={1} />

        <box width="100%" zIndex={1000} paddingTop={1} flexShrink={0}>
          <Show
            when={plainTerminal}
            fallback={
              <TuiPluginRuntime.Slot
                name="home_prompt"
                mode="replace"
                workspace_id={project.workspace.current()}
                ref={bind}
              >
                <Prompt
                  ref={bind}
                  workspaceID={project.workspace.current()}
                  right={<TuiPluginRuntime.Slot name="home_prompt_right" workspace_id={project.workspace.current()} />}
                  placeholders={placeholder}
                  prefix="> "
                />
              </TuiPluginRuntime.Slot>
            }
          >
            <Prompt
              ref={bind}
              workspaceID={project.workspace.current()}
              placeholders={placeholder}
              prefix="> "
            />
          </Show>
        </box>

        <Show when={plainTerminal}>
          <box paddingTop={1} flexShrink={0}>
            <text selectable={false}>{t("tui.tips.plain_terminal")}</text>
          </box>
        </Show>
        <Toast />
      </box>

      <Show when={!plainTerminal}>
        <box width="100%" flexShrink={0} flexDirection="column">
          <TuiPluginRuntime.Slot name="home_footer" mode="single_winner" />
          <TuiPluginRuntime.Slot name="companion_status" mode="append" />
        </box>
      </Show>
    </>
  )
}
