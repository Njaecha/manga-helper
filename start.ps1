# Manga-Helper Launcher Script (PowerShell)
# Starts both backend and frontend servers with health checks and live output

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "[OK] $args" -ForegroundColor Green }
function Write-Error { Write-Host "[ERROR] $args" -ForegroundColor Red }
function Write-Warning { Write-Host "[WARN] $args" -ForegroundColor Yellow }

# ASCII Banner
Write-Host @"
╔══════════════════════════════════════════╗
║      Manga-Helper Deployment Tool       ║
║     Backend + Frontend One-Click Start  ║
╚══════════════════════════════════════════╝
"@ -ForegroundColor Magenta

# Check if Ollama is running
Write-Info "Checking Ollama availability..."
try {
    $ollamaCheck = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Success "Ollama is running"
} catch {
    Write-Error "Ollama is not running or not accessible"
    Write-Warning "Please start Ollama first. The backend requires Ollama for AI processing."
    Write-Info "You can start Ollama by:"
    Write-Host "  - Running 'ollama serve' in a separate terminal"
    Write-Host "  - Or starting the Ollama desktop application"
    exit 1
}

# Check if required Ollama models are available
Write-Info "Checking required Ollama models..."
$ollamaResponse = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method GET
$modelNames = $ollamaResponse.models | ForEach-Object { $_.name }

$requiredModels = @(
    "huihui_ai/qwen3-vl-abliterated:4b-instruct",
    "huihui_ai/qwen3-vl-abliterated:8b-thinking"
)

$missingModels = @()
foreach ($model in $requiredModels) {
    if ($modelNames -notcontains $model) {
        $missingModels += $model
    }
}

if ($missingModels.Count -gt 0) {
    Write-Warning "Missing required Ollama models:"
    foreach ($model in $missingModels) {
        Write-Host "  - $model" -ForegroundColor Yellow
    }
    Write-Info "The application may not work correctly without these models."
    Write-Info "To install: ollama pull <model-name>"
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
} else {
    Write-Success "All required Ollama models are installed"
}

# Check if ports are available
Write-Info "Checking port availability..."

function Test-Port {
    param([int]$Port)
    $tcpConnection = New-Object System.Net.Sockets.TcpClient
    try {
        $tcpConnection.Connect("localhost", $Port)
        $tcpConnection.Close()
        return $true
    } catch {
        return $false
    }
}

if (Test-Port 8000) {
    Write-Warning "Port 8000 is already in use. Backend may already be running."
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

if (Test-Port 5173) {
    Write-Warning "Port 5173 is already in use. Frontend may already be running."
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 1
    }
}

# Start Backend
Write-Info "Starting backend server..."
$backendPath = Join-Path $PSScriptRoot "backend"
$venvPython = Join-Path $backendPath "venv\Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Write-Error "Virtual environment not found at: $venvPython"
    Write-Info "Please run: cd backend && python -m venv venv && venv\Scripts\activate && pip install -r requirements.txt"
    exit 1
}

# Start backend process with output redirection
$backendProcess = Start-Process -FilePath $venvPython `
    -ArgumentList "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000" `
    -WorkingDirectory $backendPath `
    -NoNewWindow `
    -PassThru `
    -RedirectStandardOutput (Join-Path $env:TEMP "manga-backend-stdout.log") `
    -RedirectStandardError (Join-Path $env:TEMP "manga-backend-stderr.log")

Write-Success "Backend process started (PID: $($backendProcess.Id))"

# Start a background job to tail backend logs
$backendLogJob = Start-Job -ScriptBlock {
    param($stdoutLog, $stderrLog)
    $lastStdoutSize = 0
    $lastStderrSize = 0

    while ($true) {
        Start-Sleep -Milliseconds 200

        # Check stdout
        if (Test-Path $stdoutLog) {
            $file = Get-Item $stdoutLog
            if ($file.Length -gt $lastStdoutSize) {
                $content = Get-Content $stdoutLog -Tail 100 -ErrorAction SilentlyContinue
                if ($content) {
                    $newLines = $content | Select-Object -Skip ([Math]::Max(0, $content.Count - ([Math]::Ceiling(($file.Length - $lastStdoutSize) / 100))))
                    foreach ($line in $newLines) {
                        Write-Output "[Backend] $line"
                    }
                }
                $lastStdoutSize = $file.Length
            }
        }

        # Check stderr
        if (Test-Path $stderrLog) {
            $file = Get-Item $stderrLog
            if ($file.Length -gt $lastStderrSize) {
                $content = Get-Content $stderrLog -Tail 100 -ErrorAction SilentlyContinue
                if ($content) {
                    $newLines = $content | Select-Object -Skip ([Math]::Max(0, $content.Count - ([Math]::Ceiling(($file.Length - $lastStderrSize) / 100))))
                    foreach ($line in $newLines) {
                        Write-Output "[Backend-ERR] $line"
                    }
                }
                $lastStderrSize = $file.Length
            }
        }
    }
} -ArgumentList (Join-Path $env:TEMP "manga-backend-stdout.log"), (Join-Path $env:TEMP "manga-backend-stderr.log")

# Wait for backend to be ready
Write-Info "Waiting for backend to be ready..."
$maxAttempts = 30
$attempt = 0
$backendReady = $false

while ($attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 1

    # Show any log output while waiting
    Receive-Job -Job $backendLogJob | ForEach-Object { Write-Host $_ -ForegroundColor DarkGray }

    try {
        $healthCheck = Invoke-WebRequest -Uri "http://localhost:8000/health" -Method GET -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
        if ($healthCheck.StatusCode -eq 200) {
            $backendReady = $true
            Write-Host ""
            break
        }
    } catch {
        Write-Warning "Health check failed: $($_.Exception.Message)"
        # Ignore connection errors during startup
        $attempt++
        if ($attempt -ge $maxAttempts) {
            Write-Host ""
            Write-Warning "Health check failed: $($_.Exception.Message)"
        } else {
            Write-Host "." -NoNewline
        }
    }
}

if (-not $backendReady) {
    Write-Error "Backend failed to start within 30 seconds"
    Write-Info "Last backend output:"
    Receive-Job -Job $backendLogJob | ForEach-Object { Write-Host $_ }

    Write-Info "Stopping processes..."
    Stop-Job -Job $backendLogJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendLogJob -ErrorAction SilentlyContinue
    Stop-Process -Id $backendProcess.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

Write-Success "Backend is ready at http://localhost:8000"

# Start Frontend
Write-Info "Starting frontend server..."
$frontendPath = Join-Path $PSScriptRoot "frontend"

if (-not (Test-Path (Join-Path $frontendPath "node_modules"))) {
    Write-Warning "Node modules not found. Installing dependencies..."
    Push-Location $frontendPath
    npm install
    Pop-Location
}

# Start frontend process with output redirection
$npmCmd = "npm.cmd"
$frontendProcess = Start-Process -FilePath $npmCmd `
    -ArgumentList "run", "dev" `
    -WorkingDirectory $frontendPath `
    -NoNewWindow `
    -PassThru `
    -RedirectStandardOutput (Join-Path $env:TEMP "manga-frontend-stdout.log") `
    -RedirectStandardError (Join-Path $env:TEMP "manga-frontend-stderr.log")

Write-Success "Frontend process started (PID: $($frontendProcess.Id))"

# Start a background job to tail frontend logs
$frontendLogJob = Start-Job -ScriptBlock {
    param($stdoutLog, $stderrLog)
    $lastStdoutSize = 0
    $lastStderrSize = 0

    while ($true) {
        Start-Sleep -Milliseconds 200

        # Check stdout
        if (Test-Path $stdoutLog) {
            $file = Get-Item $stdoutLog
            if ($file.Length -gt $lastStdoutSize) {
                $content = Get-Content $stdoutLog -Tail 100 -ErrorAction SilentlyContinue
                if ($content) {
                    $newLines = $content | Select-Object -Skip ([Math]::Max(0, $content.Count - ([Math]::Ceiling(($file.Length - $lastStdoutSize) / 100))))
                    foreach ($line in $newLines) {
                        Write-Output "[Frontend] $line"
                    }
                }
                $lastStdoutSize = $file.Length
            }
        }

        # Check stderr
        if (Test-Path $stderrLog) {
            $file = Get-Item $stderrLog
            if ($file.Length -gt $lastStderrSize) {
                $content = Get-Content $stderrLog -Tail 100 -ErrorAction SilentlyContinue
                if ($content) {
                    $newLines = $content | Select-Object -Skip ([Math]::Max(0, $content.Count - ([Math]::Ceiling(($file.Length - $lastStderrSize) / 100))))
                    foreach ($line in $newLines) {
                        Write-Output "[Frontend-ERR] $line"
                    }
                }
                $lastStderrSize = $file.Length
            }
        }
    }
} -ArgumentList (Join-Path $env:TEMP "manga-frontend-stdout.log"), (Join-Path $env:TEMP "manga-frontend-stderr.log")

# Wait for frontend to be ready
Write-Info "Waiting for frontend to be ready..."
$attempt = 0
$frontendReady = $false

while ($attempt -lt $maxAttempts) {
    Start-Sleep -Seconds 1

    # Show any log output while waiting
    Receive-Job -Job $frontendLogJob | ForEach-Object { Write-Host $_ -ForegroundColor DarkCyan }

    try {
        $frontendCheck = Invoke-WebRequest -Uri "http://localhost:5173" -Method GET -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        if ($frontendCheck.StatusCode -eq 200) {
            $frontendReady = $true
            Write-Host ""
            break
        }
    } catch {
        # Ignore connection errors during startup
        $attempt++
        if ($attempt -ge $maxAttempts) {
            Write-Host ""
        } else {
            Write-Host "." -NoNewline
        }
    }
}

if (-not $frontendReady) {
    Write-Warning "Frontend may not be fully ready, but continuing..."
} else {
    Write-Success "Frontend is ready at http://localhost:5173"
}

# Open browser
Write-Info "Opening browser..."
Start-Process "http://localhost:5173"

# Display status
Write-Host @"

╔══════════════════════════════════════════╗
║         Application Started!            ║
╚══════════════════════════════════════════╝

Backend:  http://localhost:8000
Frontend: http://localhost:5173

Showing live logs from both servers...
Press Ctrl+C to stop all servers.

"@ -ForegroundColor Green

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor DarkGray

# Keep script running and show live logs
$cleanupPerformed = $false

function Cleanup-Processes {
    if ($script:cleanupPerformed) { return }
    $script:cleanupPerformed = $true

    Write-Host "`n"
    Write-Info "Shutting down servers..."

    if ($script:backendLogJob) {
        Stop-Job -Job $script:backendLogJob -ErrorAction SilentlyContinue
        Remove-Job -Job $script:backendLogJob -ErrorAction SilentlyContinue
    }

    if ($script:frontendLogJob) {
        Stop-Job -Job $script:frontendLogJob -ErrorAction SilentlyContinue
        Remove-Job -Job $script:frontendLogJob -ErrorAction SilentlyContinue
    }

    if ($script:backendProcess -and -not $script:backendProcess.HasExited) {
        Write-Info "Stopping backend (PID: $($script:backendProcess.Id))..."
        Stop-Process -Id $script:backendProcess.Id -Force -ErrorAction SilentlyContinue
    }

    if ($script:frontendProcess -and -not $script:frontendProcess.HasExited) {
        Write-Info "Stopping frontend (PID: $($script:frontendProcess.Id))..."
        Stop-Process -Id $script:frontendProcess.Id -Force -ErrorAction SilentlyContinue
    }

    # Clean up temp log files
    Remove-Item (Join-Path $env:TEMP "manga-backend-stdout.log") -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $env:TEMP "manga-backend-stderr.log") -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $env:TEMP "manga-frontend-stdout.log") -ErrorAction SilentlyContinue
    Remove-Item (Join-Path $env:TEMP "manga-frontend-stderr.log") -ErrorAction SilentlyContinue

    Write-Success "All servers stopped. Goodbye!"
}

# Register Ctrl+C handler
try {
    $null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Cleanup-Processes }

    # Monitor processes and show output
    while ($true) {
        # Check if processes are still running
        if ($backendProcess.HasExited) {
            Write-Error "Backend process stopped unexpectedly (Exit code: $($backendProcess.ExitCode))"
            Receive-Job -Job $backendLogJob | ForEach-Object { Write-Host $_ }
            break
        }

        if ($frontendProcess.HasExited) {
            Write-Error "Frontend process stopped unexpectedly (Exit code: $($frontendProcess.ExitCode))"
            Receive-Job -Job $frontendLogJob | ForEach-Object { Write-Host $_ }
            break
        }

        # Display logs from both servers
        Receive-Job -Job $backendLogJob | ForEach-Object {
            Write-Host $_ -ForegroundColor DarkGray
        }

        Receive-Job -Job $frontendLogJob | ForEach-Object {
            Write-Host $_ -ForegroundColor DarkCyan
        }

        Start-Sleep -Milliseconds 500
    }
} catch {
    Write-Error "Error occurred: $_"
} finally {
    Cleanup-Processes
}
