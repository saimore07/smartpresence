<#
.SYNOPSIS
    Launches all SmartPresence components in coordinated PowerShell terminal windows.

.DESCRIPTION
    1. Verifies/Starts local MongoDB service.
    2. Launches Python FastAPI Face Recognition Engine (Port 8000).
    3. Launches Node.js Express Backend API (Port 5000).
    4. Launches React Native / Expo Metro Bundler with cache clear.
    5. Performs health checks and displays active URLs and status.
#>

param(
    [switch]$Tunnel
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "           SMARTPRESENCE - SYSTEM LAUNCHER                     " -ForegroundColor Yellow
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

$ROOT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

# Detect Primary IPv4 LAN IP (ignore loopback and 169.254 link-local)
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254*" } | Select-Object -First 1).IPAddress
if (-not $lanIp) {
    $lanIp = "127.0.0.1"
}

# --- 1. CHECK MONGODB ---
Write-Host "[1/4] Checking MongoDB Service..." -ForegroundColor Yellow
$mongoService = Get-Service -Name *mongo* -ErrorAction SilentlyContinue
if ($mongoService) {
    if ($mongoService.Status -ne "Running") {
        Write-Host "   Starting MongoDB service..." -ForegroundColor Gray
        try {
            Start-Service $mongoService.Name -ErrorAction Stop
            Write-Host "   MongoDB service started successfully." -ForegroundColor Green
        } catch {
            Write-Host "   Warning: Could not start MongoDB service automatically (may require Admin rights)." -ForegroundColor DarkYellow
            Write-Host "   If MongoDB is not running, start it manually with: Start-Service MongoDB" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "   MongoDB is running." -ForegroundColor Green
    }
} else {
    Write-Host "   MongoDB service not found by name. Assuming mongod is managed independently." -ForegroundColor DarkYellow
}

# --- 2. START PYTHON FACE SERVICE ---
Write-Host "`n[2/4] Starting AI Face Recognition Service (Port 8000)..." -ForegroundColor Yellow
$faceServiceDir = Join-Path $ROOT_DIR "face-service"
$faceCmd = @"
`$host.UI.RawUI.WindowTitle = 'SmartPresence: Face Recognition AI (Port 8000)'
cd '$faceServiceDir'
if (Test-Path '.\venv\Scripts\Activate.ps1') {
    .\venv\Scripts\Activate.ps1
}
Write-Host '===================================================' -ForegroundColor Cyan
Write-Host '   SMARTPRESENCE FACE RECOGNITION ENGINE (PORT 8000) ' -ForegroundColor Yellow
Write-Host '===================================================' -ForegroundColor Cyan
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $faceCmd

# --- 3. START EXPRESS BACKEND ---
Write-Host "[3/4] Starting Node.js Express Backend (Port 5000)..." -ForegroundColor Yellow
$serverDir = Join-Path $ROOT_DIR "server"
$serverCmd = @"
`$host.UI.RawUI.WindowTitle = 'SmartPresence: Express Backend (Port 5000)'
cd '$serverDir'
Write-Host '===================================================' -ForegroundColor Green
Write-Host '      SMARTPRESENCE BACKEND API (PORT 5000)        ' -ForegroundColor Yellow
Write-Host '===================================================' -ForegroundColor Green
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $serverCmd

# Wait a few seconds for background servers to spin up
Write-Host "   Waiting for backend services to initialize..." -ForegroundColor DarkGray
Start-Sleep -Seconds 4

# --- 4. START EXPO MOBILE APP ---
$tunnelArg = if ($Tunnel) { "--tunnel" } else { "" }
$modeLabel = if ($Tunnel) { "TUNNEL MODE (Worldwide / Any Network)" } else { "LAN MODE ($lanIp)" }

Write-Host "[4/4] Starting Expo Metro Bundler in $modeLabel..." -ForegroundColor Yellow
$mobileDir = Join-Path $ROOT_DIR "mobile"
$mobileCmd = @"
`$host.UI.RawUI.WindowTitle = 'SmartPresence: Expo Metro Bundler (Mobile)'
cd '$mobileDir'
`$env:REACT_NATIVE_PACKAGER_HOSTNAME = '$lanIp'
`$env:EXPO_PUBLIC_BACKEND_IP = '$lanIp'
Write-Host '===================================================' -ForegroundColor Magenta
Write-Host '     SMARTPRESENCE EXPO MOBILE BUNDLER             ' -ForegroundColor Yellow
Write-Host '     Mode: $modeLabel                              ' -ForegroundColor Cyan
Write-Host '===================================================' -ForegroundColor Magenta
npx expo start $tunnelArg -c
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $mobileCmd

# --- HEALTH CHECK SUMMARY ---
Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "                 HEALTH CHECK SUMMARY                          " -ForegroundColor Yellow
Write-Host "===============================================================" -ForegroundColor Cyan

# Check Python AI Service
try {
    $aiRes = Invoke-RestMethod -Uri "http://127.0.0.1:8000/ready" -Method Get -TimeoutSec 3 -ErrorAction Stop
    if ($aiRes.ready -eq $true) {
        Write-Host "   [OK] AI Face Service:   http://127.0.0.1:8000 (Models Loaded)" -ForegroundColor Green
    } else {
        Write-Host "   [WARN] AI Face Service: Responding, but models not ready" -ForegroundColor DarkYellow
    }
} catch {
    Write-Host "   [...] AI Face Service:  Starting up on http://127.0.0.1:8000" -ForegroundColor DarkGray
}

# Check Express API
try {
    $backendRes = Invoke-RestMethod -Uri "http://localhost:5000/api/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
    if ($backendRes.success -eq $true) {
        Write-Host "   [OK] Express Backend:   http://localhost:5000/api/health" -ForegroundColor Green
    } else {
        Write-Host "   [WARN] Express Backend: Unexpected response" -ForegroundColor DarkYellow
    }
} catch {
    Write-Host "   [...] Express Backend:  Starting up on http://localhost:5000" -ForegroundColor DarkGray
}

# Network IP info
Write-Host "   [INFO] Local LAN IP:    $lanIp" -ForegroundColor Cyan

Write-Host ""
Write-Host "All 3 services have been launched in separate terminal windows." -ForegroundColor Green
Write-Host "To access on Android: scan the QR code in the Expo window with Expo Go." -ForegroundColor White
Write-Host ""
Write-Host "TROUBLESHOOTING TIP:" -ForegroundColor Yellow
Write-Host "If Expo Go shows 'Failed to download remote update':" -ForegroundColor DarkYellow
Write-Host " 1. Make sure your phone is connected to the SAME Wi-Fi ($lanIp) and Mobile Data is OFF." -ForegroundColor Gray
Write-Host " 2. If your Wi-Fi has AP isolation or is a college/public network, run with Tunnel:" -ForegroundColor Gray
Write-Host "    .\start.ps1 -Tunnel" -ForegroundColor Cyan
Write-Host ""
Write-Host "To shut down all services later: run .\stop.ps1" -ForegroundColor DarkGray
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""
