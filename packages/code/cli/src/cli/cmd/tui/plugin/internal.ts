import HomeCompanion from "../feature-plugins/home/companion"
import HomeFooter from "../feature-plugins/home/footer"
import HomeLogo from "../feature-plugins/home/logo"
import HomeTips from "../feature-plugins/home/tips"
import SidebarContext from "../feature-plugins/sidebar/context"
import SidebarCwd from "../feature-plugins/sidebar/cwd"
import SidebarInstructions from "../feature-plugins/sidebar/instructions"
import SidebarMcp from "../feature-plugins/sidebar/mcp"
import SidebarLsp from "../feature-plugins/sidebar/lsp"
import SidebarGoal from "../feature-plugins/sidebar/goal"
import SidebarTask from "../feature-plugins/sidebar/task"
import SidebarTodo from "../feature-plugins/sidebar/todo"
import SidebarFiles from "../feature-plugins/sidebar/files"
import SidebarFooter from "../feature-plugins/sidebar/footer"
import PluginManager from "../feature-plugins/system/plugins"
import type { TuiPlugin, TuiPluginModule } from "@zavorth/plugin/tui"

export type InternalTuiPlugin = TuiPluginModule & {
  id: string
  tui: TuiPlugin
}

export const INTERNAL_TUI_PLUGINS: InternalTuiPlugin[] = [
  HomeCompanion,
  HomeFooter,
  HomeLogo,
  HomeTips,
  SidebarContext,
  SidebarCwd,
  SidebarInstructions,
  SidebarMcp,
  SidebarLsp,
  SidebarGoal,
  SidebarTask,
  SidebarTodo,
  SidebarFiles,
  SidebarFooter,
  PluginManager,
]
