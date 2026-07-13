/**
 * @zavorth/plugin-sdk
 *
 * Standalone publishable Plugin OS authoring surface.
 * Implementations live in sibling .js files (no monorepo relative imports).
 */

export {
  definePlugin,
  isDefinedPlugin,
  toPluginRegisterExport,
} from './definePlugin.js';

export {
  permissionPresetForModuleKind,
  resolvePluginPermissions,
} from './permissionPresets.js';

export {
  inferManifestFromDefinedPlugin,
  inferManifestFromSource,
  reconcileManifestWithInference,
} from './manifestInference.js';
