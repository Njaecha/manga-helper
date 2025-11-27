#!/usr/bin/env python3
"""
Manga-Helper Launcher Script (Cross-Platform)
Starts both backend and frontend servers with health checks and live output
Works on Windows, Linux, and macOS
"""

import subprocess
import sys
import time
import os
import platform
import signal
import webbrowser
import threading
import queue
from pathlib import Path
from typing import Optional, List

# ANSI color codes
class Colors:
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    MAGENTA = '\033[95m'
    DARK_GRAY = '\033[90m'
    DARK_CYAN = '\033[36m'
    RESET = '\033[0m'
    BOLD = '\033[1m'

def print_info(msg: str):
    print(f"{Colors.CYAN}[INFO] {msg}{Colors.RESET}")

def print_success(msg: str):
    print(f"{Colors.GREEN}[OK] {msg}{Colors.RESET}")

def print_warning(msg: str):
    print(f"{Colors.YELLOW}[WARN] {msg}{Colors.RESET}")

def print_error(msg: str):
    print(f"{Colors.RED}[ERROR] {msg}{Colors.RESET}")

def print_banner():
    banner = f"""{Colors.MAGENTA}{Colors.BOLD}
╔══════════════════════════════════════════╗
║      Manga-Helper Deployment Tool       ║
║     Backend + Frontend One-Click Start  ║
╚══════════════════════════════════════════╝
{Colors.RESET}"""
    print(banner)

def check_url(url: str, timeout: int = 5) -> bool:
    """Check if a URL is accessible"""
    try:
        import urllib.request
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.status == 200
    except Exception:
        return False

def check_ollama() -> bool:
    """Check if Ollama is running"""
    print_info("Checking Ollama availability...")
    if check_url("http://localhost:11434/api/tags"):
        print_success("Ollama is running")
        return True
    else:
        print_error("Ollama is not running or not accessible")
        print_warning("Please start Ollama first. The backend requires Ollama for AI processing.")
        print_info("You can start Ollama by:")
        print("  - Running 'ollama serve' in a separate terminal")
        print("  - Or starting the Ollama desktop application")
        return False

def check_ollama_models() -> bool:
    """Check if required Ollama models are installed"""
    print_info("Checking required Ollama models...")

    required_models = [
        "huihui_ai/qwen3-vl-abliterated:4b-instruct",
        "huihui_ai/qwen3-vl-abliterated:8b-thinking"
    ]

    try:
        import urllib.request
        import json

        response = urllib.request.urlopen("http://localhost:11434/api/tags", timeout=5)
        data = json.loads(response.read())
        installed_models = [model['name'] for model in data.get('models', [])]

        missing_models = [model for model in required_models if model not in installed_models]

        if missing_models:
            print_warning("Missing required Ollama models:")
            for model in missing_models:
                print(f"  - {model}")
            print_info("The application may not work correctly without these models.")
            print_info("To install: ollama pull <model-name>")

            response = input("Continue anyway? (y/N): ").strip().lower()
            return response == 'y'
        else:
            print_success("All required Ollama models are installed")
            return True
    except Exception as e:
        print_warning(f"Could not verify Ollama models: {e}")
        response = input("Continue anyway? (y/N): ").strip().lower()
        return response == 'y'

def check_port(port: int) -> bool:
    """Check if a port is available"""
    import socket
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(('localhost', port))
        sock.close()
        return True
    except OSError:
        return False

def check_ports() -> bool:
    """Check if required ports are available"""
    print_info("Checking port availability...")

    if not check_port(8000):
        print_warning("Port 8000 is already in use. Backend may already be running.")
        response = input("Continue anyway? (y/N): ").strip().lower()
        if response != 'y':
            return False

    if not check_port(5173):
        print_warning("Port 5173 is already in use. Frontend may already be running.")
        response = input("Continue anyway? (y/N): ").strip().lower()
        if response != 'y':
            return False

    return True

def get_venv_python(backend_path: Path) -> Optional[Path]:
    """Get the path to the virtual environment Python executable"""
    system = platform.system()

    if system == "Windows":
        venv_python = backend_path / "venv" / "Scripts" / "python.exe"
    else:
        venv_python = backend_path / "venv" / "bin" / "python"

    if venv_python.exists():
        return venv_python
    else:
        print_error(f"Virtual environment not found at: {venv_python}")
        print_info("Please run: cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt")
        return None

def stream_output(pipe, prefix: str, color: str, output_queue: queue.Queue):
    """Stream output from a subprocess pipe to console with prefix and color"""
    try:
        for line in iter(pipe.readline, ''):
            if line:
                output_queue.put((prefix, line.rstrip(), color))
    except Exception:
        pass
    finally:
        pipe.close()

def start_backend(backend_path: Path) -> Optional[tuple]:
    """Start the backend server and return (process, stdout_thread, stderr_thread, output_queue)"""
    print_info("Starting backend server...")

    venv_python = get_venv_python(backend_path)
    if not venv_python:
        return None

    try:
        # Start uvicorn via the virtual environment Python
        process = subprocess.Popen(
            [str(venv_python), "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
            cwd=str(backend_path),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )

        print_success(f"Backend process started (PID: {process.pid})")

        # Create output queue
        output_queue = queue.Queue()

        # Start threads to stream output
        stdout_thread = threading.Thread(target=stream_output, args=(process.stdout, "[Backend]", Colors.DARK_GRAY, output_queue), daemon=True)
        stderr_thread = threading.Thread(target=stream_output, args=(process.stderr, "[Backend-ERR]", Colors.DARK_GRAY, output_queue), daemon=True)

        stdout_thread.start()
        stderr_thread.start()

        return (process, stdout_thread, stderr_thread, output_queue)
    except Exception as e:
        print_error(f"Failed to start backend: {e}")
        return None

def start_frontend(frontend_path: Path) -> Optional[tuple]:
    """Start the frontend server and return (process, stdout_thread, stderr_thread, output_queue)"""
    print_info("Starting frontend server...")

    # Check if node_modules exists
    if not (frontend_path / "node_modules").exists():
        print_warning("Node modules not found. Installing dependencies...")
        try:
            subprocess.run(["npm", "install"], cwd=str(frontend_path), check=True)
        except subprocess.CalledProcessError as e:
            print_error(f"Failed to install dependencies: {e}")
            return None

    try:
        # Detect npm command (npm.cmd on Windows, npm elsewhere)
        npm_cmd = "npm.cmd" if platform.system() == "Windows" else "npm"

        process = subprocess.Popen(
            [npm_cmd, "run", "dev"],
            cwd=str(frontend_path),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )

        print_success(f"Frontend process started (PID: {process.pid})")

        # Create output queue
        output_queue = queue.Queue()

        # Start threads to stream output
        stdout_thread = threading.Thread(target=stream_output, args=(process.stdout, "[Frontend]", Colors.DARK_CYAN, output_queue), daemon=True)
        stderr_thread = threading.Thread(target=stream_output, args=(process.stderr, "[Frontend-ERR]", Colors.DARK_CYAN, output_queue), daemon=True)

        stdout_thread.start()
        stderr_thread.start()

        return (process, stdout_thread, stderr_thread, output_queue)
    except Exception as e:
        print_error(f"Failed to start frontend: {e}")
        return None

def drain_output_queue(output_queue: queue.Queue, max_lines: int = 100):
    """Drain and display output from queue"""
    lines_displayed = 0
    while not output_queue.empty() and lines_displayed < max_lines:
        try:
            prefix, line, color = output_queue.get_nowait()
            print(f"{color}{prefix} {line}{Colors.RESET}")
            lines_displayed += 1
        except queue.Empty:
            break

def wait_for_backend(output_queue: queue.Queue, max_attempts: int = 30) -> bool:
    """Wait for backend to be ready"""
    print_info("Waiting for backend to be ready...")

    for attempt in range(max_attempts):
        # Show any log output while waiting
        drain_output_queue(output_queue, max_lines=10)

        if check_url("http://localhost:8000/health", timeout=2):
            print()
            print_success("Backend is ready at http://localhost:8000")
            return True

        time.sleep(1)
        print(".", end="", flush=True)

    print()
    print_error("Backend failed to start within 30 seconds")
    print_info("Last backend output:")
    drain_output_queue(output_queue)
    return False

def wait_for_frontend(output_queue: queue.Queue, max_attempts: int = 30) -> bool:
    """Wait for frontend to be ready"""
    print_info("Waiting for frontend to be ready...")

    for attempt in range(max_attempts):
        # Show any log output while waiting
        drain_output_queue(output_queue, max_lines=10)

        if check_url("http://localhost:5173", timeout=2):
            print()
            print_success("Frontend is ready at http://localhost:5173")
            return True

        time.sleep(1)
        print(".", end="", flush=True)

    print()
    print_warning("Frontend may not be fully ready, but continuing...")
    return True

def open_browser():
    """Open the application in the default browser"""
    print_info("Opening browser...")
    try:
        webbrowser.open("http://localhost:5173")
    except Exception as e:
        print_warning(f"Could not open browser automatically: {e}")
        print_info("Please open http://localhost:5173 manually")

def cleanup_processes(processes: List[tuple]):
    """Terminate all running processes"""
    print()
    print_info("Shutting down servers...")

    for process_data in processes:
        if process_data:
            process = process_data[0]
            if process and process.poll() is None:
                try:
                    process.terminate()
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                except Exception:
                    pass

    print_success("All servers stopped. Goodbye!")

def main():
    """Main launcher function"""
    print_banner()

    # Get script directory
    script_dir = Path(__file__).parent.resolve()
    backend_path = script_dir / "backend"
    frontend_path = script_dir / "frontend"

    # Pre-flight checks
    if not check_ollama():
        sys.exit(1)

    if not check_ollama_models():
        sys.exit(1)

    if not check_ports():
        sys.exit(1)

    # Start servers
    backend_data = start_backend(backend_path)
    if not backend_data:
        sys.exit(1)

    backend_process, backend_stdout_thread, backend_stderr_thread, backend_queue = backend_data

    if not wait_for_backend(backend_queue):
        cleanup_processes([backend_data])
        sys.exit(1)

    frontend_data = start_frontend(frontend_path)
    if not frontend_data:
        cleanup_processes([backend_data])
        sys.exit(1)

    frontend_process, frontend_stdout_thread, frontend_stderr_thread, frontend_queue = frontend_data

    wait_for_frontend(frontend_queue)
    open_browser()

    # Display status
    status_message = f"""
{Colors.GREEN}╔══════════════════════════════════════════╗
║         Application Started!            ║
╚══════════════════════════════════════════╝

Backend:  http://localhost:8000
Frontend: http://localhost:5173

Showing live logs from both servers...
Press Ctrl+C to stop all servers.
{Colors.RESET}"""
    print(status_message)
    print(f"{Colors.DARK_GRAY}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{Colors.RESET}")

    # Set up signal handler for graceful shutdown
    def signal_handler(sig, frame):
        cleanup_processes([backend_data, frontend_data])
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, signal_handler)

    # Keep script running and monitor processes with live output
    try:
        while True:
            # Check if processes are still running
            if backend_process.poll() is not None:
                print_error(f"Backend process stopped unexpectedly (Exit code: {backend_process.poll()})")
                drain_output_queue(backend_queue)
                cleanup_processes([frontend_data])
                sys.exit(1)

            if frontend_process.poll() is not None:
                print_error(f"Frontend process stopped unexpectedly (Exit code: {frontend_process.poll()})")
                drain_output_queue(frontend_queue)
                cleanup_processes([backend_data])
                sys.exit(1)

            # Display logs from both servers
            drain_output_queue(backend_queue)
            drain_output_queue(frontend_queue)

            time.sleep(0.5)
    except KeyboardInterrupt:
        cleanup_processes([backend_data, frontend_data])
        sys.exit(0)

if __name__ == "__main__":
    main()
