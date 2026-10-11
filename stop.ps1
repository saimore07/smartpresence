<#
.SYNOPSIS
    Stops all running SmartPresence services and terminals cleanly.
#>

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "           SMARTPRESENCE - SYSTEM SHUTDOWN                     " -ForegroundColor Yellow
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

# Kill node processes running in SmartPresence directories
Write-Host "Stopping Node.js / Expo / Express processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        Stop-Process -Id $_.Id -Force
        Write-Host "   Stopped node process (PID: $($_.Id))" -ForegroundColor Gray
    } catch {}
}

# Kill python / uvicorn processes
Write-Host "Stopping Python AI Face Service processes..." -ForegroundColor Yellow
Get-Process -Name python -ErrorAction SilentlyContinue | ForEach-Object {
    try {
        Stop-Process -Id $_.Id -Force
        Write-Host "   Stopped python process (PID: $($_.Id))" -ForegroundColor Gray
    } catch {}
}

Write-Host ""
Write-Host "All SmartPresence services have been stopped." -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""
