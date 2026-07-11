import type { TuiPlugin, TuiPluginModule } from "@zavorth/plugin/tui"

const id = "internal:sidebar-instructions"

/**
 * Instruction file lists are not "active work" and add OpenCode-style noise.
 * Data loading is unchanged; presentation is omitted from the quiet rail.
 */
const tui: TuiPlugin = async () => {
  // no-op
}

const plugin: TuiPluginModule & { id: string } = {
  id,
  tui,
}

export default plugin
