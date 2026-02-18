# coopxv-extract Environment Sync & Setup Script (PowerShell)
# Purpose: Manage git branches and dependencies for this repository

$ErrorActionPreference = 'Stop'

# Functions for colored output
function Print-Status  { param($msg) Write-Host "[+] $msg" -ForegroundColor Green }
function Print-Error   { param($msg) Write-Host "[x] $msg" -ForegroundColor Red }
function Print-Info    { param($msg) Write-Host "[i] $msg" -ForegroundColor Cyan }
function Print-Warning { param($msg) Write-Host "[!] $msg" -ForegroundColor Yellow }

function Refresh-DevLocal {
    Print-Info "Refreshing devlocal branch..."
    git checkout devlocal
    git pull origin devlocal
    Print-Status "devlocal refreshed successfully"
}

function Sync-Environment {
    param([string]$Env)
    Print-Info "Syncing $Env environment with devlocal..."

    git checkout devlocal
    git pull origin devlocal

    git checkout $Env
    git pull origin $Env
    git merge -X theirs devlocal -m "Sync $Env with devlocal"
    git push origin $Env
    git checkout devlocal

    Print-Status "$Env synced successfully"
}

function Sync-AllEnvironments {
    Print-Info "Syncing ALL environments with devlocal..."

    git checkout devlocal
    git pull origin devlocal

    $environments = @("dev", "test", "prod", "master")

    foreach ($env in $environments) {
        Print-Info "Syncing $env..."
        git checkout $env
        git pull origin $env
        git merge -X theirs devlocal -m "Sync $env with devlocal"
        git push origin $env
        Print-Status "$env synced"
    }

    git checkout devlocal
    Print-Status "All environments synced successfully"
}

function Install-Dependencies {
    Print-Info "Installing dependencies at project root..."
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        $result = & npm install 2>&1
        if ($LASTEXITCODE -eq 0) {
            Print-Status "Dependencies installed successfully (npm)"
        } else {
            Print-Warning "npm install exited with code $LASTEXITCODE"
            $result | Write-Host
        }
    } else {
        Print-Error "npm not found. Please install Node.js/npm or run your package manager manually."
    }
}

function Rebuild-CoopxvExtract {
    Print-Info "Rebuilding coopxv-extract (dist)..."
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        $result = & npm run build:exe 2>&1
        if ($LASTEXITCODE -eq 0) {
            Print-Status "Rebuild completed successfully (npm run build:exe)"
        } else {
            Print-Warning "Rebuild exited with code $LASTEXITCODE"
            $result | Write-Host
        }
    } else {
        Print-Error "npm not found. Please install Node.js/npm or run your package manager manually."
    }
}

function Remove-MdFiles {
    Print-Warning "This will DELETE all *.md files from all folders"
    $confirm = Read-Host "Are you sure? (y/N)"
    if ($confirm -match '^[Yy]$') {
        Print-Info "Removing all .md files..."
        Get-ChildItem -Recurse -Filter "*.md" -File | Remove-Item -Force
        Print-Status "All .md files removed successfully"
    } else {
        Print-Info "Operation cancelled"
    }
}

function Get-FriendlySize {
    param([long]$Bytes)
    if ($Bytes -ge 1GB) { return "{0:N2} GB" -f ($Bytes / 1GB) }
    if ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
    if ($Bytes -ge 1KB) { return "{0:N2} KB" -f ($Bytes / 1KB) }
    return "$Bytes B"
}

function New-TarArchive {
    param([string]$ArchiveName, [string]$Source, [string[]]$Excludes)

    $excludeArgs = $Excludes | ForEach-Object { "--exclude=$_" }
    & tar -czf $ArchiveName @excludeArgs $Source 2>$null
    return $LASTEXITCODE
}

function Create-BackupArchives {
    Print-Info "Creating backup archive files..."

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $directories = @("client", "server", "mailer", "uploader", "scheduler")
    $defaultExcludes = @("node_modules", ".git", "*.log", "dist", "build")

    Print-Info "Removing old individual archive files..."
    foreach ($dir in $directories) {
        Get-ChildItem -Filter "${dir}_*.tar.gz" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    }
    Print-Status "Old individual archive files removed"

    foreach ($dir in $directories) {
        if (Test-Path $dir -PathType Container) {
            $archiveName = "${dir}_${timestamp}.tar.gz"
            Print-Info "Creating $archiveName..."
            $exitCode = New-TarArchive -ArchiveName $archiveName -Source $dir -Excludes $defaultExcludes

            if ($exitCode -le 1) {
                $size = Get-FriendlySize (Get-Item $archiveName).Length
                Print-Status "$archiveName created ($size)"
            } else {
                Print-Error "Archive creation failed with exit code $exitCode"
                return
            }
        } else {
            Print-Warning "Directory $dir not found, skipping..."
        }
    }

    Print-Info "Removing old full project archive..."
    Get-ChildItem -Filter "uavtradezone_full_*.tar.gz" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
    Print-Status "Old full project archive removed"

    $fullArchive = "uavtradezone_full_${timestamp}.tar.gz"
    Print-Info "Creating full project archive: $fullArchive..."
    $fullExcludes = $defaultExcludes + @("*.tar.gz", "chat-document")
    $exitCode = New-TarArchive -ArchiveName $fullArchive -Source "." -Excludes $fullExcludes

    if ($exitCode -le 1) {
        $size = Get-FriendlySize (Get-Item $fullArchive).Length
        Print-Status "$fullArchive created ($size)"
    } else {
        Print-Error "Archive creation failed with exit code $exitCode"
        return
    }

    Print-Status "All backup archives created successfully"
}

function Create-ProjectArchive {
    Print-Info "Creating project archive (coopxv-extract.tar.gz) excluding node_modules..."

    $archiveName = "coopxv-extract.tar.gz"

    if (Test-Path $archiveName) {
        Print-Info "Removing old archive: $archiveName"
        Remove-Item $archiveName -Force -ErrorAction SilentlyContinue
    }

    $excludes = @("node_modules", ".git", "*.log", "dist", "build", "*.tar.gz")
    $exitCode = New-TarArchive -ArchiveName $archiveName -Source "." -Excludes $excludes

    if ($exitCode -le 1) {
        $size = Get-FriendlySize (Get-Item $archiveName).Length
        Print-Status "$archiveName created ($size)"
    } else {
        Print-Error "Archive creation failed with exit code $exitCode"
    }
}

function Create-IncrementalArchives {
    $currentHour = (Get-Date).Hour

    if ($currentHour -lt 5) {
        Print-Error "Incremental archives can only be created after 5:00 AM"
        Print-Info "Current time: $(Get-Date -Format 'HH:mm:ss')"
        return
    }

    $latestFullBackup = Get-ChildItem -Filter "uavtradezone_full_*.tar.gz" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1

    if (-not $latestFullBackup) {
        Print-Error "No full backup found!"
        Print-Info "Please run Option 10 (Create full backup archives) first"
        return
    }

    # Extract timestamp from filename: uavtradezone_full_20260102_135526.tar.gz
    if ($latestFullBackup.Name -match 'uavtradezone_full_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.tar\.gz') {
        $referenceDate = Get-Date -Year $Matches[1] -Month $Matches[2] -Day $Matches[3] `
            -Hour $Matches[4] -Minute $Matches[5] -Second $Matches[6]
    } else {
        Print-Error "Could not parse timestamp from $($latestFullBackup.Name)"
        return
    }

    Print-Info "Creating incremental archives based on last full backup..."
    Print-Info "Current time: $(Get-Date -Format 'HH:mm:ss')"
    Print-Info "Last full backup: $($latestFullBackup.Name)"
    Print-Info "Reference timestamp: $($referenceDate.ToString('yyyy-MM-dd HH:mm:ss'))"
    Write-Host ""

    Print-Info "Removing old incremental archive files..."
    $oldFiles = Get-ChildItem -Filter "*_incremental_*.tar.gz" -ErrorAction SilentlyContinue
    if ($oldFiles) {
        $oldFiles | Remove-Item -Force
        Print-Status "Removed $($oldFiles.Count) old incremental archive(s)"
    } else {
        Print-Info "No old incremental archives found"
    }
    Write-Host ""

    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $directories = @("client", "server", "mailer", "uploader", "scheduler")

    $totalServices = 0
    $servicesWithChanges = 0
    $servicesSkipped = 0

    foreach ($dir in $directories) {
        if (-not (Test-Path $dir -PathType Container)) {
            Print-Warning "Directory $dir not found, skipping..."
            continue
        }

        $totalServices++
        Print-Info "Checking $dir for changes since last full backup..."

        $changedFiles = Get-ChildItem -Path $dir -Recurse -File |
            Where-Object {
                $_.LastWriteTime -gt $referenceDate -and
                $_.FullName -notmatch '[\\/](node_modules|\.git|dist|build)[\\/]' -and
                $_.Extension -ne '.log'
            }

        if (-not $changedFiles -or $changedFiles.Count -eq 0) {
            Print-Warning "  -- No changes in $dir since $($referenceDate.ToString('yyyy-MM-dd HH:mm:ss')) - SKIPPING"
            $servicesSkipped++
            Write-Host ""
            continue
        }

        Print-Status "  -- Found $($changedFiles.Count) changed file(s) in $dir"

        $tempList = [System.IO.Path]::GetTempFileName()
        $changedFiles.FullName | Set-Content $tempList

        $archiveName = "${dir}_incremental_${timestamp}.tar.gz"
        Print-Info "  -- Creating $archiveName with changed files only..."

        & tar -czf $archiveName -T $tempList 2>$null
        $tarExit = $LASTEXITCODE
        Remove-Item $tempList -Force -ErrorAction SilentlyContinue

        if ($tarExit -le 1) {
            $size = Get-FriendlySize (Get-Item $archiveName).Length
            Print-Status "  -- $archiveName created ($size, $($changedFiles.Count) files)"
            $servicesWithChanges++
        } else {
            Print-Error "  -- Archive creation failed with exit code $tarExit"
        }
        Write-Host ""
    }

    Write-Host ""
    Print-Status "=== Incremental Backup Summary ==="
    Write-Host "  - Reference backup: $($latestFullBackup.Name)"
    Write-Host "  - Reference time: $($referenceDate.ToString('yyyy-MM-dd HH:mm:ss'))"
    Write-Host "  - Total services checked: $totalServices"
    Write-Host "  - Services with changes: $servicesWithChanges"
    Write-Host "  - Services skipped (no changes): $servicesSkipped"
    Write-Host ""

    if ($servicesWithChanges -eq 0) {
        Print-Info "No changes since last full backup - no incremental archives created"
    } else {
        Print-Status "Incremental backup completed successfully"
    }
}

function Clean-CursorCache {
    Print-Warning "Cursor Cache Cleanup - This will free 3-4GB of storage"
    Print-Info "This will:"
    Write-Host "  - Delete conversation history"
    Write-Host "  - Clear bloated state databases"
    Write-Host "  - Reset workspace storage"
    Write-Host "  - Keep your settings and extensions"
    Write-Host ""
    Print-Warning "IMPORTANT: Close Cursor completely before proceeding!"
    Write-Host ""

    $confirm = Read-Host "Have you closed Cursor? Continue with cleanup? (y/N)"
    if ($confirm -notmatch '^[Yy]$') {
        Print-Info "Operation cancelled"
        return
    }

    Print-Info "Starting Cursor cache cleanup..."
    Write-Host ""

    $cursorRoot = "$env:APPDATA\Cursor"
    $globalStorage = "$cursorRoot\User\globalStorage"
    $workspaceStorage = "$cursorRoot\User\workspaceStorage"

    Print-Info "Current sizes:"
    if (Test-Path $globalStorage) {
        $size = Get-FriendlySize ((Get-ChildItem $globalStorage -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum)
        Write-Host "  - globalStorage: $size"
    }
    if (Test-Path "$globalStorage\state.vscdb") {
        $size = Get-FriendlySize (Get-Item "$globalStorage\state.vscdb").Length
        Write-Host "  - state.vscdb: $size"
    }
    if (Test-Path $workspaceStorage) {
        $size = Get-FriendlySize ((Get-ChildItem $workspaceStorage -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum)
        Write-Host "  - workspaceStorage: $size"
    }
    Write-Host ""

    Print-Info "Backing up settings..."
    $backupDir = "$HOME\cursor-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Copy-Item "$cursorRoot\User\settings.json" $backupDir -ErrorAction SilentlyContinue
    Copy-Item "$cursorRoot\User\keybindings.json" $backupDir -ErrorAction SilentlyContinue
    Print-Status "Settings backed up to: $backupDir"

    Print-Info "Deleting state.vscdb databases..."
    Remove-Item "$globalStorage\state.vscdb" -Force -ErrorAction SilentlyContinue
    Remove-Item "$globalStorage\state.vscdb.backup" -Force -ErrorAction SilentlyContinue
    Print-Status "state.vscdb deleted"

    Print-Info "Clearing workspace storage (conversation history)..."
    Remove-Item $workspaceStorage -Recurse -Force -ErrorAction SilentlyContinue
    Print-Status "workspaceStorage cleared"

    Print-Info "Clearing history..."
    Remove-Item "$cursorRoot\User\History" -Recurse -Force -ErrorAction SilentlyContinue
    Print-Status "History cleared"

    Print-Info "Clearing other caches..."
    Remove-Item "$HOME\.cursor" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "$cursorRoot\Cache" -Recurse -Force -ErrorAction SilentlyContinue
    Print-Status "Caches cleared"

    Write-Host ""
    Print-Status "Cleanup complete!"
    Write-Host ""
    Print-Info "Next steps:"
    Write-Host "  1. Restart Cursor"
    Write-Host "  2. Wait 5 minutes for re-indexing"
    Write-Host "  3. Run this cleanup monthly (1st Monday)"
}

function Clean-Exit {
    Print-Info "Preparing clean exit..."

    $confirm = Read-Host "Create backup archives before exit? (Y/n)"
    if ($confirm -notmatch '^[Nn]$') {
        Create-BackupArchives
    }

    Print-Info "Exiting..."
    exit 0
}

# Main menu loop
while ($true) {
    Write-Host ""
    Write-Host "+=======================================================+" -ForegroundColor Cyan
    Write-Host "|       coopxv-extract Environment Management            |" -ForegroundColor Cyan
    Write-Host "+=======================================================+" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Available actions:"
    Write-Host "  13) Create project archive (coopxv-extract.tar.gz - replaces previous)"
    Write-Host "  14) Rebuild coopxv-extract (dist)"
    Write-Host ""
    Write-Host "   0) Exit"
    Write-Host ""

    $choice = Read-Host "Select option"

    switch ($choice) {
        "13" { Create-ProjectArchive }
        "14" { Rebuild-CoopxvExtract }
        "0"  { Clean-Exit }
        default { Print-Error "Invalid option. Please try again." }
    }

    Write-Host ""
    Read-Host "Press Enter to continue..."
}
