$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$gatewayExe = Join-Path $projectDir '.local\mediamtx\mediamtx.exe'
$gatewayConfig = Join-Path $PSScriptRoot 'mediamtx.yml'
if (!(Test-Path -LiteralPath $gatewayExe)) { throw 'MediaMTX is missing. See local-demo/README.md for installation.' }
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodeExe = if ($nodeCommand) { $nodeCommand.Source } else { Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
if (!(Test-Path -LiteralPath $nodeExe)) { throw 'Install Node.js or add it to PATH before running this launcher.' }
$viteEntry = Join-Path $projectDir 'node_modules\vite\bin\vite.js'
if (!(Test-Path -LiteralPath $viteEntry)) { throw 'Install project dependencies first (npm install).' }
$gateway = $null
foreach ($port in @(5174, 8889, 9997)) {
  if (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) {
    throw "Port $port is already in use. Stop the existing demo/server before starting another."
  }
}
Push-Location -LiteralPath $projectDir
try {
  $gateway = Start-Process -FilePath $gatewayExe -ArgumentList ('"' + $gatewayConfig + '"') -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru
  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if ($gateway.HasExited) { throw 'MediaMTX exited before startup completed. Check its configuration and ports.' }
    try {
      Invoke-WebRequest -Uri 'http://127.0.0.1:8889/webcam/publish' -UseBasicParsing -TimeoutSec 1 | Out-Null
      $ready = $true
      break
    } catch { Start-Sleep -Milliseconds 250 }
  }
  if (!$ready) { throw 'MediaMTX did not become ready. Check ports 8889 and 8189.' }
  Write-Host 'Open http://127.0.0.1:5174 and click Start webcam demo.'
  Write-Host 'Allow camera access in your browser. Press Ctrl+C here to stop the demo servers.'
  & $nodeExe $viteEntry --host 127.0.0.1 --port 5174 --strictPort
} finally {
  if ($gateway -and !$gateway.HasExited) { Stop-Process -Id $gateway.Id }
  Pop-Location
}
