Param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$frontend = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$envFile = Join-Path $frontend ".env"
$cloudEnvFile = Join-Path $frontend ".env.cloud"

# Start with backend URL pointing to local
$content = @()
$content += "VITE_BACKEND_URL=http://localhost:$Port"

# Reuse Firebase keys from .env.cloud if present
if (Test-Path $cloudEnvFile) {
  $firebaseLines = Get-Content $cloudEnvFile | Where-Object { $_ -match '^VITE_FIREBASE_' }
  if ($firebaseLines) { $content += $firebaseLines }
}

# Write new .env
Set-Content -Path $envFile -Value ($content -join "`n") -Encoding UTF8

Write-Host "Wrote $envFile for LOCAL backend (http://localhost:$Port)."
Write-Host "Next steps:"
Write-Host "  1) Start backend: npm start --prefix ..\\..\\backend"
Write-Host "  2) Start frontend: npm run dev --prefix $frontend"
