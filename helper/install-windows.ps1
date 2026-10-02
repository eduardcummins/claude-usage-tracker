# Registers a Task Scheduler job that checks Claude usage every 10 minutes
# while this Windows user is logged in. The job runs through a small
# VBScript launcher so no console window appears. Run from the helper folder:
#   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
# Running it again replaces the existing job. To remove everything, run
# uninstall-windows.ps1.
$ErrorActionPreference = "Stop"

$taskName = "ClaudeUsageAlert"

# Resolve the real node.exe. "node" on PATH can be a shim or a per-shell
# path (fnm, nvm, volta), so ask node itself where it lives.
$node = $null
try { $node = (& node -p "process.execPath" 2>$null | Select-Object -First 1) } catch { $node = $null }
if ($node) { $node = $node.Trim() }
if (-not $node -or -not (Test-Path -LiteralPath $node)) {
  $node = (Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source
}

$cli = Join-Path $PSScriptRoot "cli.js"
if (-not (Test-Path -LiteralPath $cli)) {
  throw "Could not find cli.js next to this script."
}
$cli = (Resolve-Path -LiteralPath $cli).Path

# The launcher lives outside the downloaded source so updates never break it.
$root = Join-Path $env:USERPROFILE ".plan-pace"
New-Item -ItemType Directory -Force -Path $root | Out-Null
$launcher = Join-Path $root "run-hidden.vbs"

# VBScript doubles quotes inside a string. Window style 0 = hidden.
# True = wait for node to finish, so the task's IgnoreNew overlap rule holds.
$commandLine = '"' + $node + '" "' + $cli + '"'
$vbsCommand = $commandLine.Replace('"', '""')
$vbs = @(
  "' Cluse helper launcher. Runs the usage check with no visible window."
  "' Created by install-windows.ps1. Safe to delete with uninstall-windows.ps1."
  'Set shell = CreateObject("WScript.Shell")'
  ('shell.Run "' + $vbsCommand + '", 0, True')
)
# UTF-16 with a BOM so paths with non-English letters survive.
Set-Content -LiteralPath $launcher -Value $vbs -Encoding Unicode

# Remove any older job first (older versions ran node directly and showed a window).
$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$wscript = Join-Path $env:WINDIR "System32\wscript.exe"
$action = New-ScheduledTaskAction -Execute $wscript -Argument "//B //NoLogo `"$launcher`"" -WorkingDirectory $root
$start = (Get-Date).AddMinutes(1)
$trigger = New-ScheduledTaskTrigger -Once -At $start `
  -RepetitionInterval (New-TimeSpan -Minutes 10) `
  -RepetitionDuration (New-TimeSpan -Days 9999)
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Check Claude usage limits and send a phone alert when they reset." `
  -Force | Out-Null

Write-Host "Installed. Cluse checks about every 10 minutes in the background while this PC is awake and you are logged in."
Write-Host "Task name: $taskName"
Write-Host "To remove everything later, run this in PowerShell:"
Write-Host "  irm https://raw.githubusercontent.com/eduardcummins/claude-usage-tracker/main/helper/uninstall-windows.ps1 | iex"
