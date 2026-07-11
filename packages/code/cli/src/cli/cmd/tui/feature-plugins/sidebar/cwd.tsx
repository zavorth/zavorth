import type { TuiPlugin, TuiPluginModule } from "@zavorth/plugin/tui"

const id = "internal:sidebar-cwd"

/**
 * Workspace path lives in the prompt / status elsewhere.
 * Kept registered so external configs referencing this id stay valid,
 * but intentionally contributes nothing to the quiet sidebar rail.
 */
const tui: TuiPlugin = async () => {
  // no-op: hide cwd card from the session sidebar
}

const plugin: TuiPluginModule & { id: string } = {
  id,
  tui,
}

export default plugin
