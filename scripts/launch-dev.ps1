$startPort = 3004
$endPort = 9000
$usedPorts = @{}

foreach ($line in (netstat -ano | Out-String) -split "`r?`n") {
  if ($line -match 'LISTENING\s+\d+$' -and $line -match ':(\d+)\s+') {
    $usedPorts[[int]$Matches[1]] = $true
  }
}

foreach ($buildDir in @('.next', '.next-yearbook')) {
  if (Test-Path $buildDir) {
    Remove-Item -LiteralPath $buildDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

$chosenPort = $null
for ($port = $startPort; $port -le $endPort; $port++) {
  if (-not $usedPorts.ContainsKey($port)) {
    $chosenPort = $port
    break
  }
}

if (-not $chosenPort) {
  $chosenPort = $startPort
}

Write-Host "Starting dev server on port $chosenPort"
& npx next dev -p $chosenPort
