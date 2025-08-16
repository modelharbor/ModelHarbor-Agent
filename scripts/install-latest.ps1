# PowerShell script to install the latest version of the modelharbor-agent .vsix from bin/ using VSCode CLI

# Set error action preference to stop on errors
$ErrorActionPreference = "Stop"

Write-Host "Starting build process..." -ForegroundColor Cyan

# Run the build process
try {
    Write-Host "Running linter..." -ForegroundColor Yellow
    pnpm lint
    
    Write-Host "Rebuilding project..." -ForegroundColor Yellow
    pnpm build
    
    Write-Host "Creating VSIX package..." -ForegroundColor Yellow
    pnpm vsix
}
catch {
    Write-Host "Build process failed: $_" -ForegroundColor Red
    exit 1
}

# Find the latest .vsix file by version
Write-Host "Looking for latest VSIX file..." -ForegroundColor Yellow

$vsixFiles = Get-ChildItem -Path "bin\modelharbor-agent-*.vsix" -ErrorAction SilentlyContinue

if (-not $vsixFiles) {
    Write-Host "No .vsix files found in bin/" -ForegroundColor Red
    exit 1
}

# Sort by version and get the latest
$latestVsix = $vsixFiles | Sort-Object Name | Select-Object -Last 1

Write-Host "Found latest VSIX: $($latestVsix.Name)" -ForegroundColor Green

# Uninstall existing extension
Write-Host "Uninstalling existing extension..." -ForegroundColor Yellow
try {
    code --uninstall-extension modelharbor.modelharbor-agent
    Write-Host "Extension uninstalled successfully" -ForegroundColor Green
}
catch {
    Write-Host "Extension was not installed or uninstall failed (this is okay)" -ForegroundColor Yellow
}

# Install the new extension
Write-Host "Installing extension: $($latestVsix.FullName)" -ForegroundColor Yellow
try {
    code --install-extension "$($latestVsix.FullName)"
    Write-Host "Extension installed successfully!" -ForegroundColor Green
    Write-Host "Please restart VS Code to use the updated extension." -ForegroundColor Cyan
}
catch {
    Write-Host "Failed to install extension: $_" -ForegroundColor Red
    exit 1
}
