import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { UserError } from './errors.js';

export const LAUNCH_AGENT_LABEL = 'com.claude-usage-alert';

export function cliPath() {
  return fileURLToPath(new URL('../cli.js', import.meta.url));
}

export function buildLaunchAgentPlist({ nodePath, scriptPath, homeDir, intervalSeconds = 600 }) {
  const logDir = path.join(homeDir, 'Library', 'Logs');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LAUNCH_AGENT_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xml(nodePath)}</string>
    <string>${xml(scriptPath)}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>${intervalSeconds}</integer>
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>
  <key>StandardOutPath</key>
  <string>${xml(path.join(logDir, 'claude-usage-alert.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${xml(path.join(logDir, 'claude-usage-alert.err.log'))}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${xml(homeDir)}</string>
    <key>PATH</key>
    <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
`;
}

export function plistPath(homeDir) {
  return path.join(homeDir, 'Library', 'LaunchAgents', `${LAUNCH_AGENT_LABEL}.plist`);
}

export async function installMac(deps) {
  if (deps.platform !== 'darwin') {
    throw new UserError('install-mac is for macOS. On Windows, run helper\\install-windows.ps1 in PowerShell.');
  }
  const homeDir = deps.homeDir;
  const nodePath = deps.execPath || process.execPath;
  const scriptPath = deps.cliPath || cliPath();
  const target = plistPath(homeDir);
  const xmlText = buildLaunchAgentPlist({ nodePath, scriptPath, homeDir });
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.mkdir(path.join(homeDir, 'Library', 'Logs'), { recursive: true });
  await fs.writeFile(target, xmlText);
  const uid = deps.uid ?? process.getuid();
  const domain = `gui/${uid}`;
  await launchctl(['bootout', domain, target], deps).catch(() => {});
  await launchctl(['bootstrap', domain, target], deps);
  await launchctl(['enable', `${domain}/${LAUNCH_AGENT_LABEL}`], deps).catch(() => {});
  await launchctl(['kickstart', '-k', `${domain}/${LAUNCH_AGENT_LABEL}`], deps).catch(() => {});
  deps.log(`Installed. macOS will check Claude usage every 10 minutes while you are logged in.`);
  deps.log(`Logs: ${path.join(homeDir, 'Library', 'Logs', 'claude-usage-alert.log')}`);
  return 0;
}

export async function uninstallMac(deps) {
  if (deps.platform !== 'darwin') {
    throw new UserError('uninstall-mac is for macOS.');
  }
  const target = plistPath(deps.homeDir);
  const uid = deps.uid ?? process.getuid();
  await launchctl(['bootout', `gui/${uid}`, target], deps).catch(() => {});
  await fs.rm(target, { force: true });
  deps.log('Removed the macOS background check. The phone topic and saved usage were left in place.');
  return 0;
}

function launchctl(args, deps) {
  if (deps.launchctl) return deps.launchctl(args);
  return execText('/bin/launchctl', args);
}

function execText(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 20000 }, (err, stdout, stderr) => {
      if (err) {
        const error = new Error(stderr || err.message);
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

function xml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
