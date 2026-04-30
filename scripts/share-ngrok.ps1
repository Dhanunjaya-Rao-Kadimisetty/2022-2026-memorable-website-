function Get-NgrokCommand {
  if ($env:NGROK_PATH -and (Test-Path $env:NGROK_PATH)) {
    return (Resolve-Path $env:NGROK_PATH).Path
  }

  $command = Get-Command ngrok -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  $candidatePaths = @(
    (Join-Path $env:USERPROFILE 'Downloads\ngrok-v3-stable-windows-amd64\ngrok.exe'),
    (Join-Path $env:USERPROFILE 'Downloads\ngrok-v3-stable-windows-amd64 (1)\ngrok.exe')
  )

  foreach ($candidate in $candidatePaths) {
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }

  return $null
}

function Stop-ProcessOnPort {
  param(
    [int]$Port
  )

  $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($processId in $connections) {
    if (-not $processId) {
      continue
    }

    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
  }
}

$ngrokExe = Get-NgrokCommand
if (-not $ngrokExe) {
  Write-Host "ngrok was not found on this machine."
  Write-Host "Set NGROK_PATH to your ngrok.exe file, or install ngrok globally."
  exit 1
}

Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Stop-ProcessOnPort -Port 3003

$buildOut = Join-Path $PWD 'share-build.out.log'
$buildErr = Join-Path $PWD 'share-build.err.log'
$startOut = Join-Path $PWD 'share-start.out.log'
$startErr = Join-Path $PWD 'share-start.err.log'
foreach ($f in @($buildOut, $buildErr, $startOut, $startErr)) {
  if (Test-Path $f) {
    Remove-Item $f -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "Building the app for sharing..."
$buildOutput = & npm.cmd run build 2>&1
$buildOutput | Tee-Object -FilePath $buildOut | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build failed. Check $buildOut and $buildErr for details."
  exit 1
}

Write-Host "Starting production server on port 3003..."
$startProcess = Start-Process -FilePath "npm.cmd" -ArgumentList @('run', 'start') -WorkingDirectory $PWD -WindowStyle Hidden -PassThru -RedirectStandardOutput $startOut -RedirectStandardError $startErr

$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  try {
    $response = Invoke-WebRequest -Uri 'http://127.0.0.1:3003' -TimeoutSec 2 -UseBasicParsing
    if ($response.StatusCode -ge 200) {
      $ready = $true
      break
    }
  } catch {
    if ($startProcess.HasExited) {
      break
    }
  }
}

if (-not $ready) {
  Write-Host "Production server did not become ready."
  Write-Host "Check $startOut and $startErr for details."
  if (-not $startProcess.HasExited) {
    Stop-Process -Id $startProcess.Id -Force -ErrorAction SilentlyContinue
  }
  exit 1
}

Write-Host "Local app is running at http://localhost:3003"
Write-Host "Opening ngrok tunnel now."
& $ngrokExe http 3003
