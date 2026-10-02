# Registers a Task Scheduler job that checks Claude usage every 10 minutes
# while this Windows user is logged in. Run from the helper folder:
#   powershell -ExecutionPolicy Bypass -File .\install-windows.ps1
$ErrorActionPreference = "Stop"

$node = (Get-Command node -ErrorAction Stop).Source
$cli = Join-Path $PSScriptRoot "cli.js"
if (-not (Test-Path $cli)) {
  throw "Could not find cli.js next to this script."
}

$action = New-ScheduledTaskAction -Execute $node -Argument "`"$cli`""
$start = (Get-Date).AddMinutes(1)
$trigger = New-ScheduledTaskTrigger -Once -At $start `
  -RepetitionInterval (New-TimeSpan -Minutes 10) `
  -RepetitionDuration (New-TimeSpan -Days 9999)
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -StartWhenAvailable `
  -MultipleInstances IgnoreNew

Register-ScheduledTask `
  -TaskName "ClaudeUsageAlert" `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Check Claude usage limits and send a phone alert when they reset." `
  -Force | Out-Null

Write-Host "Installed. Task Scheduler will run the helper every 10 minutes while you are logged in."
Write-Host "Task name: ClaudeUsageAlert"
Write-Host "To remove it later: Unregister-ScheduledTask -TaskName ClaudeUsageAlert -Confirm:`$false"
