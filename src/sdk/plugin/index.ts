export {
  definePlugin,
  isDefinedPlugin,
  toPluginRegisterExport,
  type DefinePluginInput,
  type DefinePluginToolSpec,
  type DefinePluginHookHandler,
  type DefinedPlugin,
} from './definePlugin.js';

export {
  permissionPresetForModuleKind,
  resolvePluginPermissions,
} from './permissionPresets.js';

export {
  inferManifestFromDefinedPlugin,
  inferManifestFromSource,
  reconcileManifestWithInference,
  type ManifestInferenceResult,
} from './manifestInference.js';
