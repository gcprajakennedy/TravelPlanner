$ErrorActionPreference = "Stop"

$frontend = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$envFile = Join-Path $frontend ".env"
$cloudEnvFile = Join-Path $frontend ".env.cloud"

if (!(Test-Path $cloudEnvFile)) {
  Write-Error ".env.cloud not found at $cloudEnvFile. Create it first with your Cloud Run URL and Firebase keys."
  exit 1
}

Copy-Item -Path $cloudEnvFile -Destination $envFile -Force

Write-Host "Copied $cloudEnvFile -> $envFile for CLOUD backend."
Write-Host "Next steps:"
Write-Host "  1) Restart the dev server if running (Ctrl+C)." 
Write-Host "  2) Start frontend: npm run dev --prefix $frontend"
