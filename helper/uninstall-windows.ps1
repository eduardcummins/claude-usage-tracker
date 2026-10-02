# Removes the Cluse helper from this Windows PC: the scheduled task, the
# downloaded helper and its settings. Run either of:
#   irm https://raw.githubusercontent.com/eduardcummins/claude-usage-tracker/main/helper/uninstall-windows.ps1 | iex
#   powershell -ExecutionPolicy Bypass -File .\uninstall-windows.ps1
# Node.js and Claude Code are not touched.
$ErrorActionPreference = "Continue"

$taskName = "ClaudeUsageAlert"
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
  Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Removed the scheduled task $taskName."
} else {
  Write-Host "No scheduled task named $taskName was found."
}

# Give a check that was already running a moment to exit.
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -like "*\.plan-pace\*" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

$paths = @(
  (Join-Path $env:USERPROFILE ".plan-pace"),
  (Join-Path $env:USERPROFILE ".claude-usage-alert"),
  (Join-Path $env:TEMP "plan-pace-main.zip"),
  (Join-Path $env:TEMP "plan-pace-unpack")
)
foreach ($p in $paths) {
  if (Test-Path -LiteralPath $p) {
    Remove-Item -LiteralPath $p -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $p) {
      Write-Host "Could not delete $p. Close any window using it and run this again."
    } else {
      Write-Host "Deleted $p"
    }
  }
}

Write-Host "Cluse helper removed from this PC. Your Claude Code login was not changed."
