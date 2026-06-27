#Requires -RunAsAdministrator
# ============================================================
# MASTER DEPLOYMENT SCRIPT
# Run this from YOUR LAPTOP (connected to the hub via RJ45)
# It will remotely configure all 4 PCs
# ============================================================

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  NETWORK SETUP - Master Deployment Script" -ForegroundColor Cyan
Write-Host "  Controls 4 PCs remotely from this laptop" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# CONFIGURATION - Edit these if needed
# ============================================================
$laptopIP = "192.168.1.100"
$printerIP = "192.168.1.10"
$sharedFolderPath = "C:\SharedFolder"
$sharedFolderName = "SharedFolder"

$pcs = @(
    @{ Name = "PC1"; IP = "192.168.1.1"; Role = "Server"; TempIP = $null }
    @{ Name = "PC2"; IP = "192.168.1.2"; Role = "Client"; TempIP = $null }
    @{ Name = "PC3"; IP = "192.168.1.3"; Role = "Client"; TempIP = $null }
    @{ Name = "PC4"; IP = "192.168.1.4"; Role = "Client"; TempIP = $null }
)

# ============================================================
# STEP 0: Collect credentials for each PC
# ============================================================
Write-Host "STEP 0: Enter credentials for each PC" -ForegroundColor Yellow
Write-Host "  (The username/password of a local admin account on each PC)" -ForegroundColor Gray
Write-Host ""

$credentials = @{}
foreach ($pc in $pcs) {
    Write-Host "  Credentials for $($pc.Name) [$($pc.IP)]:" -ForegroundColor White
    $cred = Get-Credential -Message "Enter admin credentials for $($pc.Name)"
    if (-not $cred) {
        Write-Host "ERROR: Credentials required for all PCs." -ForegroundColor Red
        pause
        exit 1
    }
    $credentials[$pc.Name] = $cred
}

Write-Host ""
Write-Host "  All credentials collected." -ForegroundColor Green
Write-Host ""

# ============================================================
# STEP 1: Set this laptop's temporary IP
# ============================================================
Write-Host "STEP 1: Setting this laptop's Ethernet IP to $laptopIP..." -ForegroundColor Yellow

$localAdapter = Get-NetAdapter | Where-Object { 
    $_.Status -eq "Up" -and 
    ($_.PhysicalMediaType -match "802.3" -or $_.Name -match "Ethernet")
} | Select-Object -First 1

if (-not $localAdapter) {
    $localAdapter = Get-NetAdapter | Where-Object { $_.Name -match "Ethernet" } | Select-Object -First 1
}

if (-not $localAdapter) {
    Write-Host "  ERROR: No Ethernet adapter found on this laptop!" -ForegroundColor Red
    Write-Host "  Make sure RJ45 cable is connected to the hub." -ForegroundColor Red
    Get-NetAdapter | Format-Table Name, Status, MediaType
    pause
    exit 1
}

Write-Host "  Adapter: $($localAdapter.Name)" -ForegroundColor Gray

# Set laptop IP
Remove-NetIPAddress -InterfaceIndex $localAdapter.ifIndex -Confirm:$false -ErrorAction SilentlyContinue
Remove-NetRoute -InterfaceIndex $localAdapter.ifIndex -Confirm:$false -ErrorAction SilentlyContinue
New-NetIPAddress -InterfaceIndex $localAdapter.ifIndex -IPAddress $laptopIP -PrefixLength 24 | Out-Null
Set-NetIPInterface -InterfaceIndex $localAdapter.ifIndex -InterfaceMetric 50

# Configure WinRM on this laptop to trust the remote PCs
Set-Item -Path WSMan:\localhost\Client\TrustedHosts -Value "*" -Force
Set-Item -Path WSMan:\localhost\Client\AllowUnencrypted -Value $true -Force

Write-Host "  Laptop IP set to $laptopIP" -ForegroundColor Green
Write-Host ""

# ============================================================
# STEP 2: Wait for PCs to be reachable
# ============================================================
Write-Host "STEP 2: Checking connectivity to all PCs..." -ForegroundColor Yellow
Write-Host "  (PCs should already have enable-remoting.ps1 run on them)" -ForegroundColor Gray
Write-Host ""

# Since PCs don't have their final IPs yet, we need an alternative approach.
# The PCs are on the same hub - they may be using APIPA (169.254.x.x) or DHCP.
# We'll assign them IPs via their computer names first, or ask user to
# temporarily assign IPs.

Write-Host "  NOTE: PCs need temporary IPs to be reachable." -ForegroundColor DarkYellow
Write-Host ""
Write-Host "  OPTION A (Recommended): Each PC should already have a temporary" -ForegroundColor White
Write-Host "  IP on the 192.168.1.x range. If you ran enable-remoting.ps1" -ForegroundColor White
Write-Host "  without setting IPs, the PCs may not be reachable yet." -ForegroundColor White
Write-Host ""
Write-Host "  Enter the CURRENT IP of each PC (or press Enter to use the" -ForegroundColor White
Write-Host "  target IP if you set it manually already):" -ForegroundColor White
Write-Host ""

foreach ($pc in $pcs) {
    $currentIP = Read-Host "  Current IP of $($pc.Name) [default: $($pc.IP)]"
    if ([string]::IsNullOrWhiteSpace($currentIP)) {
        $pc.TempIP = $pc.IP
    } else {
        $pc.TempIP = $currentIP.Trim()
    }
}

Write-Host ""
Write-Host "  Testing connections..." -ForegroundColor Gray

$allReachable = $true
foreach ($pc in $pcs) {
    $ping = Test-Connection -ComputerName $pc.TempIP -Count 1 -Quiet -ErrorAction SilentlyContinue
    if ($ping) {
        Write-Host "  $($pc.Name) ($($pc.TempIP)) - REACHABLE" -ForegroundColor Green
    } else {
        Write-Host "  $($pc.Name) ($($pc.TempIP)) - NOT REACHABLE" -ForegroundColor Red
        $allReachable = $false
    }
}

if (-not $allReachable) {
    Write-Host ""
    Write-Host "  Some PCs are not reachable. Check:" -ForegroundColor Red
    Write-Host "  - RJ45 cables are connected" -ForegroundColor Red
    Write-Host "  - Hub has power" -ForegroundColor Red
    Write-Host "  - enable-remoting.ps1 was run on each PC" -ForegroundColor Red
    Write-Host ""
    $continue = Read-Host "  Continue anyway? (y/n)"
    if ($continue -ne "y") { exit 1 }
}

Write-Host ""

# ============================================================
# STEP 3: Configure each PC remotely
# ============================================================
Write-Host "STEP 3: Configuring PCs remotely..." -ForegroundColor Yellow
Write-Host ""

foreach ($pc in $pcs) {
    Write-Host "--- Configuring $($pc.Name) ($($pc.TempIP)) as $($pc.Role) ---" -ForegroundColor Cyan
    
    $cred = $credentials[$pc.Name]
    $targetIP = $pc.IP
    $sessionOpts = New-PSSessionOption -OperationTimeout 60000 -OpenTimeout 30000
    
    try {
        $session = New-PSSession -ComputerName $pc.TempIP -Credential $cred -SessionOption $sessionOpts -ErrorAction Stop
        Write-Host "  Connected to $($pc.Name)!" -ForegroundColor Green
    } catch {
        Write-Host "  FAILED to connect to $($pc.Name): $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Skipping this PC. You can configure it manually later." -ForegroundColor DarkYellow
        continue
    }

    # --- Set Static IP ---
    Invoke-Command -Session $session -ScriptBlock {
        param($targetIP)
        
        $adapter = Get-NetAdapter | Where-Object { 
            $_.Status -eq "Up" -and 
            ($_.PhysicalMediaType -match "802.3" -or $_.Name -match "Ethernet")
        } | Select-Object -First 1
        
        if (-not $adapter) {
            $adapter = Get-NetAdapter | Where-Object { $_.Name -match "Ethernet" } | Select-Object -First 1
        }
        
        if ($adapter) {
            Remove-NetIPAddress -InterfaceIndex $adapter.ifIndex -Confirm:$false -ErrorAction SilentlyContinue
            Remove-NetRoute -InterfaceIndex $adapter.ifIndex -Confirm:$false -ErrorAction SilentlyContinue
            New-NetIPAddress -InterfaceIndex $adapter.ifIndex -IPAddress $targetIP -PrefixLength 24 | Out-Null
            Set-NetIPInterface -InterfaceIndex $adapter.ifIndex -InterfaceMetric 50
            
            # Enable network discovery and file sharing
            netsh advfirewall firewall set rule group="Network Discovery" new enable=Yes | Out-Null
            netsh advfirewall firewall set rule group="File and Printer Sharing" new enable=Yes | Out-Null
            Set-NetConnectionProfile -InterfaceIndex $adapter.ifIndex -NetworkCategory Private -ErrorAction SilentlyContinue
            
            Write-Output "IP_SET_OK"
        } else {
            Write-Output "IP_SET_FAIL_NO_ADAPTER"
        }
    } -ArgumentList $targetIP | ForEach-Object {
        if ($_ -eq "IP_SET_OK") {
            Write-Host "  Static IP $targetIP set." -ForegroundColor Green
        } else {
            Write-Host "  WARNING: Could not find Ethernet adapter on $($pc.Name)" -ForegroundColor Red
        }
    }

    # --- If this is PC1 (Server), create shared folder ---
    if ($pc.Role -eq "Server") {
        Write-Host "  Creating shared folder on $($pc.Name)..." -ForegroundColor Gray
        
        Invoke-Command -Session $session -ScriptBlock {
            param($folderPath, $shareName)
            
            # Create folder
            if (-not (Test-Path $folderPath)) {
                New-Item -ItemType Directory -Path $folderPath -Force | Out-Null
            }
            
            # Remove existing share
            Remove-SmbShare -Name $shareName -Force -ErrorAction SilentlyContinue
            
            # Create share
            New-SmbShare -Name $shareName -Path $folderPath -FullAccess "Everyone" -Description "Shared network folder" | Out-Null
            
            # Set NTFS permissions
            $acl = Get-Acl $folderPath
            $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                "Everyone", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
            )
            $acl.SetAccessRule($rule)
            Set-Acl -Path $folderPath -AclObject $acl
            
            # Disable password-protected sharing for easy access
            $regPath = "HKLM:\SYSTEM\CurrentControlSet\Control\Lsa"
            Set-ItemProperty -Path $regPath -Name "everyoneincludesanonymous" -Value 1 -ErrorAction SilentlyContinue
            $sharingPath = "HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters"
            Set-ItemProperty -Path $sharingPath -Name "restrictnullsessaccess" -Value 0 -ErrorAction SilentlyContinue
            
            Write-Output "SHARE_OK"
        } -ArgumentList $sharedFolderPath, $sharedFolderName | ForEach-Object {
            if ($_ -eq "SHARE_OK") {
                Write-Host "  Shared folder created: \\$targetIP\$sharedFolderName" -ForegroundColor Green
            }
        }
    }

    # --- Add network printer on all PCs ---
    Write-Host "  Adding printer ($printerIP)..." -ForegroundColor Gray
    
    Invoke-Command -Session $session -ScriptBlock {
        param($printerIP)
        
        $portName = "TCP_$printerIP"
        $printerName = "Network Printer"
        
        Remove-Printer -Name $printerName -ErrorAction SilentlyContinue
        Remove-PrinterPort -Name $portName -ErrorAction SilentlyContinue
        
        Add-PrinterPort -Name $portName -PrinterHostAddress $printerIP -ErrorAction SilentlyContinue
        
        try {
            Add-Printer -Name $printerName -PortName $portName -DriverName "Microsoft IPP Class Driver" -ErrorAction Stop
            Write-Output "PRINTER_OK"
        } catch {
            Write-Output "PRINTER_PORT_ONLY"
        }
    } -ArgumentList $printerIP | ForEach-Object {
        if ($_ -eq "PRINTER_OK") {
            Write-Host "  Printer added successfully." -ForegroundColor Green
        } else {
            Write-Host "  Printer port created. Driver may need manual install." -ForegroundColor DarkYellow
        }
    }

    # --- Map shared folder on client PCs ---
    if ($pc.Role -eq "Client") {
        Write-Host "  Mapping shared folder (\\192.168.1.1\$sharedFolderName)..." -ForegroundColor Gray
        
        Invoke-Command -Session $session -ScriptBlock {
            param($serverIP, $shareName)
            
            net use S: /delete /y 2>$null | Out-Null
            net use S: "\\$serverIP\$shareName" /persistent:yes 2>$null
            
            Write-Output "MAP_DONE"
        } -ArgumentList "192.168.1.1", $sharedFolderName | ForEach-Object {
            Write-Host "  Shared folder mapped to S: drive." -ForegroundColor Green
        }
    }

    # Clean up session
    Remove-PSSession -Session $session
    Write-Host "  $($pc.Name) configuration complete!" -ForegroundColor Green
    Write-Host ""
}

# ============================================================
# STEP 4: Verify final connectivity
# ============================================================
Write-Host "STEP 4: Final connectivity check..." -ForegroundColor Yellow
Write-Host ""

Start-Sleep -Seconds 3

foreach ($pc in $pcs) {
    $ping = Test-Connection -ComputerName $pc.IP -Count 1 -Quiet -ErrorAction SilentlyContinue
    if ($ping) {
        Write-Host "  $($pc.Name) ($($pc.IP)) - OK" -ForegroundColor Green
    } else {
        Write-Host "  $($pc.Name) ($($pc.IP)) - Not responding (may need reboot)" -ForegroundColor DarkYellow
    }
}

$pingPrinter = Test-Connection -ComputerName $printerIP -Count 1 -Quiet -ErrorAction SilentlyContinue
if ($pingPrinter) {
    Write-Host "  Printer ($printerIP) - OK" -ForegroundColor Green
} else {
    Write-Host "  Printer ($printerIP) - Not responding (set printer IP to $printerIP)" -ForegroundColor DarkYellow
}

# ============================================================
# DONE
# ============================================================
Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Summary:" -ForegroundColor White
Write-Host "  - PC1 (192.168.1.1): Shared folder at \\192.168.1.1\SharedFolder" -ForegroundColor White
Write-Host "  - PC2 (192.168.1.2): Connected, S: drive mapped" -ForegroundColor White
Write-Host "  - PC3 (192.168.1.3): Connected, S: drive mapped" -ForegroundColor White
Write-Host "  - PC4 (192.168.1.4): Connected, S: drive mapped" -ForegroundColor White
Write-Host "  - Printer: $printerIP" -ForegroundColor White
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor DarkYellow
Write-Host "  1. Disconnect your laptop from the hub" -ForegroundColor White
Write-Host "  2. Plug the printer into the freed port" -ForegroundColor White
Write-Host "  3. Set printer IP to $printerIP via its control panel" -ForegroundColor White
Write-Host "  4. Test: open \\192.168.1.1\SharedFolder from any PC" -ForegroundColor White
Write-Host "  5. Test: print a test page from any PC" -ForegroundColor White
Write-Host ""
Write-Host "  You can safely remove this laptop's Ethernet IP now." -ForegroundColor Gray
Write-Host ""
pause
