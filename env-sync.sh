#!/bin/bash

# coopxv-extract Environment Sync & Setup Script
# Purpose: Manage git branches and dependencies for this repository

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Function to refresh to devlocal
refresh_devlocal() {
    print_info "Refreshing devlocal branch..."
    git checkout devlocal
    git pull origin devlocal
    print_status "devlocal refreshed successfully"
}

# Function to sync a specific environment
sync_environment() {
    local env=$1
    print_info "Syncing $env environment with devlocal..."
    
    git checkout devlocal
    git pull origin devlocal
    
    git checkout $env
    git pull origin $env
    git merge -X theirs devlocal -m "Sync $env with devlocal"
    git push origin $env
    git checkout devlocal
    
    print_status "$env synced successfully"
}

# Function to sync all environments (including test)
sync_all_environments() {
    print_info "Syncing ALL environments with devlocal..."
    
    git checkout devlocal
    git pull origin devlocal
    
    environments=("dev" "test" "prod" "master")
    
    for env in "${environments[@]}"; do
        print_info "Syncing $env..."
        git checkout $env
        git pull origin $env
        git merge -X theirs devlocal -m "Sync $env with devlocal"
        git push origin $env
        print_status "$env synced"
    done
    
    git checkout devlocal
    print_status "All environments synced successfully"
}

# Function to run pnpm install in all directories
# Simplified: install dependencies at project root using pnpm
install_dependencies() {
    print_info "Installing dependencies at project root..."
    if command -v pnpm >/dev/null 2>&1; then
        set +e
        pnpm install
        pnpm_exit=$?
        set -e

        if [ $pnpm_exit -eq 0 ]; then
            print_status "Dependencies installed successfully (pnpm)"
        else
            print_warning "pnpm install exited with code $pnpm_exit"
        fi
    else
        print_error "pnpm not found. Please install pnpm or run your package manager manually."
    fi
}

# Function to remove all .md files
remove_md_files() {
    print_warning "This will DELETE all *.md files from all folders"
    read -p "Are you sure? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        print_info "Removing all .md files..."
        find . -type f -name "*.md" -delete
        print_status "All .md files removed successfully"
    else
        print_info "Operation cancelled"
    fi
}

# Function to create backup archives and remove old ones
create_backup_archives() {
    print_info "Creating backup archive files..."
    
    timestamp=$(date +"%Y%m%d_%H%M%S")
    directories=("client" "server" "mailer" "uploader" "scheduler")
    
    print_info "Removing old individual archive files..."
    for dir in "${directories[@]}"; do
        rm -f "${dir}_"*.tar.gz 2>/dev/null || true
    done
    print_status "Old individual archive files removed"
    
    for dir in "${directories[@]}"; do
        if [ -d "$dir" ]; then
            print_info "Creating ${dir}_${timestamp}.tar.gz..."
            set +e
            tar -czf "${dir}_${timestamp}.tar.gz" \
                --exclude='node_modules' \
                --exclude='.git' \
                --exclude='*.log' \
                --exclude='dist' \
                --exclude='build' \
                "$dir"
            tar_exit=$?
            set -e
            
            if [ $tar_exit -eq 0 ]; then
                print_status "${dir}_${timestamp}.tar.gz created ($(du -h "${dir}_${timestamp}.tar.gz" | cut -f1))"
            elif [ $tar_exit -eq 1 ]; then
                print_warning "Archive created with warnings (some files changed during archiving)"
                print_status "${dir}_${timestamp}.tar.gz created ($(du -h "${dir}_${timestamp}.tar.gz" | cut -f1))"
            else
                print_error "Archive creation failed with exit code $tar_exit"
                return 1
            fi
        else
            print_warning "Directory $dir not found, skipping..."
        fi
    done
    
    print_info "Removing old full project archive..."
    rm -f uavtradezone_full_*.tar.gz 2>/dev/null || true
    print_status "Old full project archive removed"
    
    print_info "Creating full project archive: uavtradezone_full_${timestamp}.tar.gz..."
    set +e
    tar -czf "uavtradezone_full_${timestamp}.tar.gz" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='*.log' \
        --exclude='dist' \
        --exclude='build' \
        --exclude='*.tar.gz' \
        --exclude='chat-document' \
        .
    tar_exit=$?
    set -e
    
    if [ $tar_exit -eq 0 ]; then
        print_status "uavtradezone_full_${timestamp}.tar.gz created ($(du -h "uavtradezone_full_${timestamp}.tar.gz" | cut -f1))"
    elif [ $tar_exit -eq 1 ]; then
        print_warning "Archive created with warnings (some files changed during archiving)"
        print_status "uavtradezone_full_${timestamp}.tar.gz created ($(du -h "uavtradezone_full_${timestamp}.tar.gz" | cut -f1))"
    else
        print_error "Archive creation failed with exit code $tar_exit"
        return 1
    fi
    
    print_status "All backup archives created successfully"
}

# Create a single project archive (replace previous) excluding node_modules
create_project_archive() {
    print_info "Creating project archive (coopxv-extract.tar.gz) excluding node_modules..."

    archive_name="coopxv-extract.tar.gz"

    # Remove previous archive (replace behavior requested)
    if [ -f "$archive_name" ]; then
        print_info "Removing old archive: $archive_name"
        rm -f "$archive_name" || true
    fi

    set +e
    tar -czf "$archive_name" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='*.log' \
        --exclude='dist' \
        --exclude='build' \
        --exclude='*.tar.gz' \
        .
    tar_exit=$?
    set -e

    if [ $tar_exit -eq 0 ]; then
        print_status "$archive_name created ($(du -h "$archive_name" | cut -f1))"
    elif [ $tar_exit -eq 1 ]; then
        print_warning "Archive created with warnings (some files changed during archiving)"
        print_status "$archive_name created ($(du -h "$archive_name" | cut -f1))"
    else
        print_error "Archive creation failed with exit code $tar_exit"
        return 1
    fi
}

# NEW FUNCTION: Create incremental archives based on last full backup timestamp
create_incremental_archives() {
    # Check if current time is after 5am
    current_hour=$(date +%H)
    
    if [ "$current_hour" -lt 5 ]; then
        print_error "Incremental archives can only be created after 5:00 AM"
        print_info "Current time: $(date +%H:%M:%S)"
        print_info "Please wait until 5:00 AM to create incremental archives"
        return 1
    fi
    
    # Find the most recent full backup
    latest_full_backup=$(ls -t uavtradezone_full_*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "$latest_full_backup" ]; then
        print_error "No full backup found!"
        print_info "Please run Option 10 (Create full backup archives) first"
        return 1
    fi
    
    # Extract timestamp from filename: uavtradezone_full_20260102_135526.tar.gz
    # Result: 20260102_135526
    backup_timestamp=$(echo "$latest_full_backup" | sed 's/uavtradezone_full_\(.*\)\.tar\.gz/\1/')
    
    # Parse timestamp: YYYYMMDD_HHMMSS
    backup_date=$(echo "$backup_timestamp" | cut -d'_' -f1)  # 20260102
    backup_time=$(echo "$backup_timestamp" | cut -d'_' -f2)  # 135526
    
    # Convert to format: YYYY-MM-DD HH:MM:SS
    reference_date="${backup_date:0:4}-${backup_date:4:2}-${backup_date:6:2}"
    reference_time="${backup_time:0:2}:${backup_time:2:2}:${backup_time:4:2}"
    reference_datetime="$reference_date $reference_time"
    
    print_info "Creating incremental archives based on last full backup..."
    print_info "Current time: $(date +%H:%M:%S)"
    print_info "Last full backup: $latest_full_backup"
    print_info "Reference timestamp: $reference_datetime"
    echo ""
    
    # Remove old incremental archives
    print_info "Removing old incremental archive files..."
    old_count=$(find . -maxdepth 1 -name "*_incremental_*.tar.gz" | wc -l)
    if [ "$old_count" -gt 0 ]; then
        rm -f *_incremental_*.tar.gz 2>/dev/null || true
        print_status "Removed $old_count old incremental archive(s)"
    else
        print_info "No old incremental archives found"
    fi
    echo ""
    
    timestamp=$(date +"%Y%m%d_%H%M%S")
    directories=("client" "server" "mailer" "uploader" "scheduler")
    
    total_services=0
    services_with_changes=0
    services_skipped=0
    
    for dir in "${directories[@]}"; do
        if [ ! -d "$dir" ]; then
            print_warning "Directory $dir not found, skipping..."
            continue
        fi
        
        total_services=$((total_services + 1))
        
        print_info "Checking $dir for changes since last full backup..."
        
        # Find files modified AFTER the last full backup timestamp
        changed_files=$(find "$dir" -type f \
            -not -path "*/node_modules/*" \
            -not -path "*/.git/*" \
            -not -path "*/dist/*" \
            -not -path "*/build/*" \
            -not -name "*.log" \
            -newermt "$reference_datetime" 2>/dev/null)
        
        file_count=$(echo "$changed_files" | grep -c . || echo "0")
        
        if [ "$file_count" -eq 0 ] || [ -z "$changed_files" ]; then
            print_warning "  └─ No changes in $dir since $reference_datetime - SKIPPING"
            services_skipped=$((services_skipped + 1))
            echo ""
            continue
        fi
        
        print_status "  └─ Found $file_count changed file(s) in $dir"
        
        temp_list="/tmp/${dir}_incremental_${timestamp}.txt"
        echo "$changed_files" > "$temp_list"
        
        archive_name="${dir}_incremental_${timestamp}.tar.gz"
        print_info "  └─ Creating $archive_name with changed files only..."
        
        set +e
        tar -czf "$archive_name" -T "$temp_list" 2>/dev/null
        tar_exit=$?
        set -e
        
        rm -f "$temp_list"
        
        if [ $tar_exit -eq 0 ] || [ $tar_exit -eq 1 ]; then
            archive_size=$(du -h "$archive_name" | cut -f1)
            print_status "  └─ $archive_name created ($archive_size, $file_count files)"
            services_with_changes=$((services_with_changes + 1))
        else
            print_error "  └─ Archive creation failed with exit code $tar_exit"
        fi
        
        echo ""
    done
    
    echo ""
    print_status "=== Incremental Backup Summary ==="
    echo "  • Reference backup: $latest_full_backup"
    echo "  • Reference time: $reference_datetime"
    echo "  • Total services checked: $total_services"
    echo "  • Services with changes: $services_with_changes"
    echo "  • Services skipped (no changes): $services_skipped"
    echo "  • Incremental timestamp: $timestamp"
    echo ""
    
    if [ $services_with_changes -eq 0 ]; then
        print_info "No changes since last full backup - no incremental archives created"
    else
        print_status "Incremental backup completed successfully"
        print_info "Archives contain ONLY files modified after: $reference_datetime"
        print_info "Old incremental archives were deleted before creating new ones"
    fi
}

# Function to clean Cursor cache
clean_cursor_cache() {
    print_warning "Cursor Cache Cleanup - This will free 3-4GB of storage"
    print_info "This will:"
    echo "  • Delete conversation history"
    echo "  • Clear bloated state databases"
    echo "  • Reset workspace storage"
    echo "  • Keep your settings and extensions"
    echo ""
    print_warning "IMPORTANT: Close Cursor completely before proceeding!"
    echo ""
    read -p "Have you closed Cursor? Continue with cleanup? (y/N): " confirm
    
    if [[ ! $confirm =~ ^[Yy]$ ]]; then
        print_info "Operation cancelled"
        return
    fi
    
    print_info "Starting Cursor cache cleanup..."
    echo ""
    
    print_info "Current sizes:"
    if [ -d ~/AppData/Roaming/Cursor/User/globalStorage/ ]; then
        echo "  • globalStorage: $(du -sh ~/AppData/Roaming/Cursor/User/globalStorage/ 2>/dev/null | cut -f1)"
    fi
    if [ -f ~/AppData/Roaming/Cursor/User/globalStorage/state.vscdb ]; then
        echo "  • state.vscdb: $(du -sh ~/AppData/Roaming/Cursor/User/globalStorage/state.vscdb 2>/dev/null | cut -f1)"
    fi
    if [ -d ~/AppData/Roaming/Cursor/User/workspaceStorage/ ]; then
        echo "  • workspaceStorage: $(du -sh ~/AppData/Roaming/Cursor/User/workspaceStorage/ 2>/dev/null | cut -f1)"
    fi
    if [ -d ~/AppData/Roaming/Cursor/ ]; then
        echo "  • Total Cursor: $(du -sh ~/AppData/Roaming/Cursor/ 2>/dev/null | cut -f1)"
    fi
    echo ""
    
    print_info "Backing up settings..."
    BACKUP_DIR=~/cursor-backup-$(date +%Y%m%d-%H%M%S)
    mkdir -p "$BACKUP_DIR"
    cp ~/AppData/Roaming/Cursor/User/settings.json "$BACKUP_DIR/" 2>/dev/null || print_warning "settings.json not found"
    cp ~/AppData/Roaming/Cursor/User/keybindings.json "$BACKUP_DIR/" 2>/dev/null || print_warning "keybindings.json not found"
    print_status "Settings backed up to: $BACKUP_DIR"
    
    print_info "Deleting state.vscdb databases..."
    rm -f ~/AppData/Roaming/Cursor/User/globalStorage/state.vscdb 2>/dev/null && print_status "state.vscdb deleted" || print_warning "state.vscdb not found"
    rm -f ~/AppData/Roaming/Cursor/User/globalStorage/state.vscdb.backup 2>/dev/null && print_status "state.vscdb.backup deleted" || print_warning "state.vscdb.backup not found"
    
    print_info "Clearing workspace storage (conversation history)..."
    rm -rf ~/AppData/Roaming/Cursor/User/workspaceStorage/ 2>/dev/null && print_status "workspaceStorage cleared" || print_warning "workspaceStorage not found"
    
    print_info "Clearing history..."
    rm -rf ~/AppData/Roaming/Cursor/User/History/ 2>/dev/null && print_status "History cleared" || print_warning "History not found"
    
    print_info "Clearing other caches..."
    rm -rf ~/.cursor/ 2>/dev/null && print_status "~/.cursor cleared" || print_warning "~/.cursor not found"
    rm -rf ~/AppData/Roaming/Cursor/Cache/ 2>/dev/null && print_status "Cache cleared" || print_warning "Cache not found"
    
    echo ""
    print_status "Cleanup complete!"
    echo ""
    
    print_info "New sizes:"
    if [ -d ~/AppData/Roaming/Cursor/User/globalStorage/ ]; then
        echo "  • globalStorage: $(du -sh ~/AppData/Roaming/Cursor/User/globalStorage/ 2>/dev/null | cut -f1)"
    fi
    if [ -d ~/AppData/Roaming/Cursor/User/ ]; then
        echo "  • User folder: $(du -sh ~/AppData/Roaming/Cursor/User/ 2>/dev/null | cut -f1)"
    fi
    if [ -d ~/AppData/Roaming/Cursor/ ]; then
        echo "  • Total Cursor: $(du -sh ~/AppData/Roaming/Cursor/ 2>/dev/null | cut -f1)"
    fi
    echo ""
    
    print_status "Freed approximately 3-4GB of storage"
    print_info "Next steps:"
    echo "  1. Restart Cursor"
    echo "  2. Wait 5 minutes for re-indexing"
    echo "  3. Run this cleanup monthly (1st Monday)"
    echo ""
    print_info "Estimated cost savings: \$40-70/month"
}

# Function to handle clean exit
clean_exit() {
    print_info "Preparing clean exit..."
    
    read -p "Create backup archives before exit? (Y/n): " create_archive
    if [[ ! $create_archive =~ ^[Nn]$ ]]; then
        create_backup_archives
    fi
    
    print_info "Exiting..."
    exit 0
}

# Main menu (trimmed - removed unused options)
show_menu() {
    echo ""
    echo -e "${BLUE}╔═════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║       coopxv-extract Environment Management         ║${NC}"
    echo -e "${BLUE}╚═════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "Available actions:"
    echo "  13) Create project archive (coopxv-extract.tar.gz - replaces previous)"
    echo ""
    echo "  0) Exit"
    echo ""
}

# Main loop
while true; do
    show_menu
    read -p "Select option: " choice
    
    case $choice in
        13) create_project_archive ;;
        0) clean_exit ;;
        *) print_error "Invalid option. Please try again." ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
done