const fs = require('fs');
const path = require('path');
const { withFinalizedMod } = require('expo/config-plugins');

/**
 * This app schedules local reset alarms. It does not use Apple push.
 * expo-notifications still writes an aps-environment entitlement, and a free
 * Personal Team in Xcode cannot sign an app that has that capability.
 * The removal runs in a finalized mod so it happens after that plugin writes
 * the entitlements file.
 */
function withoutPushEntitlement(config) {
  return withFinalizedMod(config, [
    'ios',
    async (config) => {
      const entitlementsPath = findEntitlements(config.modRequest.platformProjectRoot);
      if (!entitlementsPath) return config;
      const xml = fs.readFileSync(entitlementsPath, 'utf8');
      const next = stripApsEnvironment(xml);
      if (next !== xml) fs.writeFileSync(entitlementsPath, next);
      return config;
    },
  ]);
}

function findEntitlements(dir) {
  if (!dir || !fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findEntitlements(full);
      if (found) return found;
    } else if (entry.name.endsWith('.entitlements')) {
      return full;
    }
  }
  return null;
}

function stripApsEnvironment(xml) {
  return xml.replace(/[ \t]*<key>aps-environment<\/key>\s*<string>[^<]*<\/string>\s*/, '');
}

module.exports = withoutPushEntitlement;
module.exports.stripApsEnvironment = stripApsEnvironment;
