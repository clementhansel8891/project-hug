# Local Network Setup - Automated Remote Deployment

## Overview
Set up 4 PCs + 1 printer on a hub, all controlled from YOUR laptop.

## Network Layout
```
[Your Laptop] ---RJ45---> [HUB Port 1] (temporary, for setup only)
[PC1 - Server] ---RJ45---> [HUB Port 2]  ← hosts shared folder
[PC2]          ---RJ45---> [HUB Port 3]
[PC3]          ---RJ45---> [HUB Port 4]
[PC4]          ---RJ45---> [HUB Port 5]
[Printer]      ---RJ45---> connected to hub (set IP manually)
```

> If you only have a 5-port hub, your laptop takes port 1 during setup,
> then after setup is done, disconnect laptop and plug printer into that port.

## IP Address Plan

| Device         | IP Address    | Role              |
|----------------|---------------|-------------------|
| Your Laptop    | 192.168.1.100 | Setup controller (temporary) |
| PC1 (Server)   | 192.168.1.1   | Hosts shared folder |
| PC2            | 192.168.1.2   | Client            |
| PC3            | 192.168.1.3   | Client            |
| PC4            | 192.168.1.4   | Client            |
| Printer        | 192.168.1.10  | Network printer   |

## Setup Steps (2 phases)

### PHASE 1: Prepare PCs (one-time, requires physical access)

Copy the `usb-prep` folder to a USB drive. On EACH of the 4 PCs:
1. Plug in the USB
2. Right-click `enable-remoting.ps1` → "Run with PowerShell" AS ADMINISTRATOR
3. It takes 10 seconds. Done. Remove USB.

This enables PowerShell Remoting so your laptop can control them remotely.

### PHASE 2: Run Master Script (from your laptop)

1. Connect your laptop to the hub via RJ45
2. Open PowerShell AS ADMINISTRATOR on your laptop
3. Navigate to this folder
4. Run: `.\deploy-all.ps1`
5. The script will:
   - Set your laptop's temporary IP (192.168.1.100)
   - Connect to each PC and configure it remotely
   - Set static IPs on all PCs
   - Create shared folder on PC1
   - Add printer on all PCs
   - Verify connectivity

### PHASE 3: Set Printer IP

Set printer's static IP to 192.168.1.10 via its control panel:
- Usually: Menu → Network → TCP/IP → Manual/Static
- IP: 192.168.1.10, Subnet: 255.255.255.0, Gateway: 192.168.1.1

### After Setup

- Disconnect your laptop from the hub
- Plug printer into the freed port
- All PCs access shared folder at: `\\192.168.1.1\SharedFolder`
- All PCs print to: `192.168.1.10`
- Wi-Fi still provides internet on all PCs

## File Structure
```
___NETWORK-SETUP-4PC-1PRINTER___/
├── README.md                ← You are here
├── deploy-all.ps1           ← Master script (run from your laptop)
├── usb-prep/
│   └── enable-remoting.ps1  ← Copy to USB, run on each PC once
```

## Troubleshooting

- **"WinRM cannot connect"**: Re-run `enable-remoting.ps1` on that PC
- **Shared folder not accessible**: Check PC1 is on and connected to hub
- **Printer not working**: Verify printer shows 192.168.1.10 on its config page
- **Internet still works**: Yes! Wi-Fi handles internet, Ethernet handles local only
