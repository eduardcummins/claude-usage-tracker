const fs = require('fs');
const path = require('path');
const { withFinalizedMod } = require('expo/config-plugins');

/**
 * Plan Pace scans a QR code. It does not record audio.
 * expo-camera still writes a microphone usage string on iOS.
 */
function withoutMicrophone(config) {
  return withFinalizedMod(config, [
    'ios',
    async (config) => {
      const plistPath = findInfoPlist(config.modRequest.platformProjectRoot);
      if (!plistPath) return config;
      const xml = fs.readFileSync(plistPath, 'utf8');
      const next = stripMicrophoneUsage(xml);
      if (next !== xml) fs.writeFileSync(plistPath, next);
      return config;
    },
  ]);
}

function findInfoPlist(dir) {
  if (!dir || !fs.existsSync(dir)) return null;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findInfoPlist(full);
      if (found) return found;
    } else if (entry.name === 'Info.plist') {
      return full;
    }
  }
  return null;
}

function stripMicrophoneUsage(xml) {
  return xml.replace(/\s*<key>NSMicrophoneUsageDescription<\/key>\s*<string>[\s\S]*?<\/string>/, '');
}

module.exports = withoutMicrophone;
module.exports.stripMicrophoneUsage = stripMicrophoneUsage;
