<#
.SYNOPSIS
    Stops all running SmartPresence services and terminals cleanly.
#>

Write-Host ""
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host "           SMARTPRESENCE - SYSTEM SHUTDOWN                     " -ForegroundColor Yellow
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""

# Find and stop processes bound to SmartPresence ports (Express: 5000, AI: 8000, Metro: 8081)
Write-Host "Identifying SmartPresence processes on ports 5000, 8000, and 8081..." -ForegroundColor Yellow
$targetPorts = @(5000, 8000, 8081)
$stoppedPids = @{}

foreach ($port in $targetPorts) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        foreach ($conn in $connections) {
            $pidToStop = $conn.OwningProcess
            if ($pidToStop -and -not $stoppedPids.ContainsKey($pidToStop) -and $pidToStop -ne $PID) {
                try {
                    $p = Get-Process -Id $pidToStop -ErrorAction SilentlyContinue
                    if ($p) {
                        Stop-Process -Id $pidToStop -Force
                        $stoppedPids[$pidToStop] = $true
                        Write-Host "   Stopped $($p.ProcessName) on port $port (PID: $pidToStop)" -ForegroundColor Green
                    }
                } catch {}
            }
        }
    } catch {}
}

# Also stop any PowerShell launcher windows or processes specifically running SmartPresence paths
try {
    $spProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        ($_.CommandLine -like "*SmartPresence*" -or $_.CommandLine -like "*uvicorn app.main:app*") -and
        $_.ProcessId -ne $PID -and -not $stoppedPids.ContainsKey($_.ProcessId)
    }
    foreach ($proc in $spProcesses) {
        try {
            Stop-Process -Id $proc.ProcessId -Force
            Write-Host "   Stopped SmartPresence background process (PID: $($proc.ProcessId))" -ForegroundColor Gray
        } catch {}
    }
} catch {}

Write-Host ""
Write-Host "All SmartPresence services have been stopped." -ForegroundColor Green
Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host ""
