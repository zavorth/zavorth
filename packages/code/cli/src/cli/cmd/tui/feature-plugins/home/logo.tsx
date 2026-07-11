import type { TuiPlugin, TuiPluginModule } from "@zavorth/plugin/tui"
import { ZavorthMascot } from "../../component/zavorth-mascot"

/**
 * home_logo slot — static mascot only (animation removed).
 * Primary placement is inside WelcomeBox; this slot stays available
 * if a plugin or alternate home layout wants the mascot alone.
 */
function HomeLogo() {
  return (
    <box flexDirection="column" alignItems="center" justifyContent="center">
      <ZavorthMascot />
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: 10,
    slots: {
      home_logo() {
        return <HomeLogo />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "internal:home-logo",
  tui,
}

export default plugin
