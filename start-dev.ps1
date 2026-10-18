# ==============================================================================
# BusBook - Smart Bus Reservation Application Development Startup Script
# PowerShell Script for Windows
# ==============================================================================

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   🚌 BusBook - Smart Bus Reservation System Startup      " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check Node.js
Write-Host "[1/5] Checking Node.js runtime..." -ForegroundColor White
try {
    $nodeVersion = node -v
    Write-Host "      ✓ Node.js detected: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "      ✗ Error: Node.js is not found in PATH. Please install Node.js (v18+) to continue." -ForegroundColor Red
    exit 1
}

# 2. Check MongoDB Connectivity
Write-Host "[2/5] Checking MongoDB database availability on localhost:27017..." -ForegroundColor White
$mongoTest = Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -WarningAction SilentlyContinue
if ($mongoTest.TcpTestSucceeded) {
    Write-Host "      ✓ MongoDB is active and reachable on port 27017" -ForegroundColor Green
} else {
    Write-Host "      ⚠ Warning: MongoDB is not responding on 127.0.0.1:27017." -ForegroundColor Yellow
    Write-Host "        Please make sure your MongoDB Community service is started (net start MongoDB) or your cloud URI is set in backend/.env" -ForegroundColor Yellow
}

# 3. Check Backend Dependencies & Environment
Write-Host "[3/5] Verifying backend configuration and dependencies..." -ForegroundColor White
$backendPath = Join-Path $PSScriptRoot "backend"
if (-not (Test-Path (Join-Path $backendPath "node_modules"))) {
    Write-Host "      Installing backend packages..." -ForegroundColor Gray
    Start-Process -FilePath "npm" -ArgumentList "install" -WorkingDirectory $backendPath -NoNewWindow -Wait
}
Write-Host "      ✓ Backend dependencies ready" -ForegroundColor Green

# 4. Check Frontend Dependencies & Environment
Write-Host "[4/5] Verifying frontend configuration..." -ForegroundColor White
$frontendPath = Join-Path $PSScriptRoot "frontend"
if (-not (Test-Path (Join-Path $frontendPath "node_modules"))) {
    Write-Host "      Installing frontend packages..." -ForegroundColor Gray
    Start-Process -FilePath "npm" -ArgumentList "install" -WorkingDirectory $frontendPath -NoNewWindow -Wait
}
Write-Host "      ✓ Frontend dependencies ready" -ForegroundColor Green

# 5. Launch Backend and Frontend in separate windows
Write-Host "[5/5] Launching BusBook services..." -ForegroundColor White

Write-Host "      Starting Express Backend on port 3000..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; npm run dev"

Start-Sleep -Seconds 2

Write-Host "      Starting Vite Frontend on port 5173..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; npm run dev"

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   🚀 BusBook Application Running!                        " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Frontend URL:     http://localhost:5173" -ForegroundColor White
Write-Host "  Backend API:      http://localhost:3000/api" -ForegroundColor White
Write-Host "  API Health Check: http://localhost:3000/api/health" -ForegroundColor White
Write-Host ""
Write-Host "  Staff Accounts:" -ForegroundColor Yellow
Write-Host "  - Super Admin:       admin@busbook.com     / Admin@12345" -ForegroundColor White
Write-Host "  - Bus Ops Manager:   bus.ops@busbook.com   / Password@123" -ForegroundColor White
Write-Host "  - Booking Manager:   bookings@busbook.com  / Password@123" -ForegroundColor White
Write-Host "  - Finance Manager:   finance@busbook.com   / Password@123" -ForegroundColor White
Write-Host ""
