$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$installDir = Join-Path $projectDir '.local\mediamtx'
$archivePath = Join-Path $projectDir '.local\mediamtx.zip'
$checksumPath = Join-Path $projectDir '.local\checksums.sha256'
$version = 'v1.21.2'
$archiveName = "mediamtx_${version}_windows_amd64.zip"
$releaseUrl = "https://github.com/bluenviron/mediamtx/releases/download/$version"
if ($env:OS -ne 'Windows_NT') { throw 'This installer targets Windows x64. See local-demo/README.md for other operating systems.' }
if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne 'X64') { throw 'This installer requires Windows x64.' }
if (Test-Path -LiteralPath (Join-Path $installDir 'mediamtx.exe')) {
  Write-Host 'MediaMTX is already installed. Run .\local-demo\start-demo.ps1.'
  exit 0
}
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Write-Host "Downloading MediaMTX $version from its official GitHub release..."
Invoke-WebRequest -Uri "$releaseUrl/$archiveName" -OutFile $archivePath -UseBasicParsing
Invoke-WebRequest -Uri "$releaseUrl/checksums.sha256" -OutFile $checksumPath -UseBasicParsing
$checksumLines = @(Get-Content -LiteralPath $checksumPath | Where-Object { $_ -match ([regex]::Escape($archiveName) + '$') })
if ($checksumLines.Count -ne 1) { throw 'Could not identify the release checksum.' }
$expectedHash = ($checksumLines[0] -split '\s+')[0]
$actualHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
if ($actualHash -ne $expectedHash) { throw 'SHA-256 verification failed; the archive was not extracted.' }
Expand-Archive -LiteralPath $archivePath -DestinationPath $installDir -Force
Write-Host 'MediaMTX installed and SHA-256 verified. Run .\local-demo\start-demo.ps1.'
