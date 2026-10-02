export const MAC_INSTALL =
  'curl -fsSL https://raw.githubusercontent.com/eduardcummins/claude-usage-tracker/main/helper/bootstrap-mac.sh | bash';

export const WINDOWS_INSTALL =
  'irm https://raw.githubusercontent.com/eduardcummins/claude-usage-tracker/main/helper/bootstrap-windows.ps1 | iex';

export type ComputerKind = 'mac' | 'windows';

export function installCommand(kind: ComputerKind): string {
  return kind === 'windows' ? WINDOWS_INSTALL : MAC_INSTALL;
}
