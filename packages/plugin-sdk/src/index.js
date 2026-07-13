'use strict';

const {
  definePlugin,
  isDefinedPlugin,
  toPluginRegisterExport,
} = require('./definePlugin.js');
const {
  permissionPresetForModuleKind,
  resolvePluginPermissions,
} = require('./permissionPresets.js');
const {
  inferManifestFromDefinedPlugin,
  inferManifestFromSource,
  reconcileManifestWithInference,
} = require('./manifestInference.js');

module.exports = {
  definePlugin,
  isDefinedPlugin,
  toPluginRegisterExport,
  permissionPresetForModuleKind,
  resolvePluginPermissions,
  inferManifestFromDefinedPlugin,
  inferManifestFromSource,
  reconcileManifestWithInference,
};
