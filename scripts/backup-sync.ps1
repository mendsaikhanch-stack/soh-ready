# SOH-Ready Project Auto Backup Script
# Runs every 2 hours via Windows Task Scheduler
# Syncs project changes to E:\soh-ready-backup

$Source = "C:\Users\MNG\Desktop\projects\soh-ready"
$Destination = "E:\soh-ready-backup"
$LogFile = "E:\soh-ready-backup\backup-log.txt"

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# Check if E: drive is available
if (-not (Test-Path "E:\")) {
    Add-Content -Path "$Source\backup-error.log" -Value "$timestamp - ERROR: E: drive not found"
    exit 1
}

# Run robocopy mirror sync
$result = robocopy $Source $Destination /MIR /XD node_modules .next .claude /XF .env .env.local /NFL /NDL /NJH /NJS /nc /ns /np 2>&1

# Log the result
if ($LASTEXITCODE -lt 8) {
    Add-Content -Path $LogFile -Value "$timestamp - SUCCESS (exit: $LASTEXITCODE)"
} else {
    Add-Content -Path $LogFile -Value "$timestamp - ERROR (exit: $LASTEXITCODE): $result"
}
