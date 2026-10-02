# Downloads Cluse and prints the phone topic. Meant to be run with:
#   irm https://raw.githubusercontent.com/eduardcummins/claude-usage-tracker/main/helper/bootstrap-windows.ps1 | iex
$ErrorActionPreference = "Stop"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js 20 or newer is required."
  Write-Host "Install it from https://nodejs.org and run this command again."
  exit 1
}

$major = [int](node -p "process.versions.node.split('.')[0]")
if ($major -lt 20) {
  Write-Host "Node.js 20 or newer is required. This PC has $(node -v)."
  exit 1
}

$root = Join-Path $env:USERPROFILE ".plan-pace"
$src = Join-Path $root "src"
$zip = Join-Path $env:TEMP "plan-pace-main.zip"
$url = "https://github.com/eduardcummins/claude-usage-tracker/archive/refs/heads/main.zip"

Write-Host "Downloading the Cluse helper..."
try {
  Invoke-WebRequest -Uri $url -OutFile $zip
} catch {
  Write-Host "Could not download the helper."
  Write-Host "The GitHub project has to be public for this command to work."
  exit 1
}

$unpack = Join-Path $env:TEMP "plan-pace-unpack"
if (Test-Path $unpack) { Remove-Item $unpack -Recurse -Force }
Expand-Archive -Path $zip -DestinationPath $unpack -Force
$extracted = Get-ChildItem $unpack -Directory | Select-Object -First 1
if (-not $extracted) { throw "The download did not contain the helper." }
if (Test-Path $src) { Remove-Item $src -Recurse -Force }
New-Item -ItemType Directory -Force -Path $root | Out-Null
Move-Item $extracted.FullName $src
Remove-Item $zip -Force
Remove-Item $unpack -Recurse -Force -ErrorAction SilentlyContinue

$cli = Join-Path $src "helper\cli.js"
node $cli --init
& (Join-Path $src "helper\install-windows.ps1")
Write-Host ""
Write-Host "Leave this PC awake. Cluse on the phone reads a new report about every 10 minutes."
