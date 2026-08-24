/**
 * Compatibility boundary shim: canonical implementation moved to the AI gateway
 * MITM proxy plane. Legacy imports from src/zavorth-control resolve here.
 */
module.exports = require('../../ai-gateway/mitm/proxyPlane.cjs');
