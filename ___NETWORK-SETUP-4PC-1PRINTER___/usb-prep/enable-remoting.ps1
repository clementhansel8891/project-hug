#Requires -RunAsAdministrator
# ============================================================
# USB PREP SCRIPT - Run this on EACH PC once (as Administrator)
# This enables remote management so the master laptop can
# configure this PC automatically.
# ============================================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Enabling Remote Management on this PC" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Enable PowerShell Remoting ---
Write-Host "[1/4] Enabling PowerShell Remoting..." -ForegroundColor Yellow
Enable-PSRemoting -Force -SkipNetworkProfileCheck | Out-Null
Write-Host "  Done." -ForegroundColor Green

# --- Set WinRM to accept unencrypted (for local network simplicity) ---
Write-Host "[2/4] Configuring WinRM for local network..." -ForegroundColor Yellow
Set-Item -Path WSMan:\localhost\Service\AllowUnencrypted -Value $true -Force
Set-Item -Path WSMan:\localhost\Client\AllowUnencrypted -Value $true -Force
Set-Item -Path WSMan:\localhost\Service\Auth\Basic -Value $true -Force
Set-Item -Path WSMan:\localhost\Client\Auth\Basic -Value $true -Force

# Allow any host to connect (local network)
Set-Item -Path WSMan:\localhost\Client\TrustedHosts -Value "*" -Force
Write-Host "  Done." -ForegroundColor Green

# --- Open Firewall for WinRM ---
Write-Host "[3/4] Opening firewall for remote management..." -ForegroundColor Yellow
netsh advfirewall firewall set rule name="Windows Remote Management (HTTP-In)" new enable=Yes | Out-Null
# Also enable ICMP (ping) for troubleshooting
netsh advfirewall firewall add rule name="Allow ICMPv4" protocol=icmpv4:8,any dir=in action=allow | Out-Null
Write-Host "  Done." -ForegroundColor Green

# --- Set a known local admin password (for remote connection) ---
Write-Host "[4/4] Setting up remote access credentials..." -ForegroundColor Yellow
Write-Host ""
Write-Host "  IMPORTANT: The master script needs a username/password to connect." -ForegroundColor DarkYellow
Write-Host "  Make sure this PC has a LOCAL admin account with a known password." -ForegroundColor DarkYellow
Write-Host ""
Write-Host "  If the current admin account has no password, set one now:" -ForegroundColor DarkYellow
Write-Host "  → Open Settings > Accounts > Sign-in Options > Password" -ForegroundColor White
Write-Host "  → Or run: net user <username> <password>" -ForegroundColor White
Write-Host ""

# --- Restart WinRM service ---
Restart-Service WinRM -Force

Write-Host "============================================" -ForegroundColor Green
Write-Host "  REMOTE MANAGEMENT ENABLED!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  This PC is now ready to be configured" -ForegroundColor White
Write-Host "  remotely from the master laptop." -ForegroundColor White
Write-Host ""
Write-Host "  Computer Name: $env:COMPUTERNAME" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Remember the admin username and password" -ForegroundColor DarkYellow
Write-Host "  for this PC - you'll need it in the master script." -ForegroundColor DarkYellow
Write-Host ""
pause
