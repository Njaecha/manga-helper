# Manga-Helper Deployment Guide

This guide will help you quickly start the Manga-Helper application with one click using the provided launcher scripts.

## 🚀 Quick Start

### Windows Users

**Option 1: Double-click the batch file (Easiest)**
```
Double-click: start.bat
```

**Option 2: Run PowerShell script**
```powershell
.\start.ps1
```

**Option 3: Use Python launcher (Cross-platform)**
```bash
python start.py
```

### Linux/macOS Users

**Option 1: Run Python launcher**
```bash
python3 start.py
```

**Option 2: Make script executable and run**
```bash
chmod +x start.py
./start.py
```

### Using NPM Scripts

If you have npm installed globally:
```bash
npm run dev           # Start both servers (uses Python launcher)
npm run start:python  # Explicitly use Python launcher
npm run start:windows # Use PowerShell launcher (Windows only)
npm run backend       # Start backend only
npm run frontend      # Start frontend only
```

## 📋 Prerequisites

Before running the application, ensure you have:

### 1. **Ollama** (REQUIRED)
- **Install**: Download from [https://ollama.ai](https://ollama.ai)
- **Start**: Run `ollama serve` or start the Ollama desktop app
- **Verify**: The launcher will check if Ollama is running on `http://localhost:11434`

### 2. **Required Ollama Models**
Install these models before first use:
```bash
ollama pull huihui_ai/qwen3-vl-abliterated:4b-instruct
ollama pull huihui_ai/qwen3-vl-abliterated:8b-thinking
```

### 3. **Python 3.8+**
- Check: `python --version`
- Backend requires Python for FastAPI and AI processing

### 4. **Node.js 18+**
- Check: `node --version`
- Frontend requires Node.js for Svelte and Vite

### 5. **Virtual Environment Setup** (First-time only)

If you haven't set up the Python virtual environment yet:

**Windows:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

**Linux/macOS:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 6. **Frontend Dependencies** (First-time only)

```bash
cd frontend
npm install
```

Or use the convenience script:
```bash
npm run install:all
```

## 🎯 What the Launcher Does

The launcher scripts automatically:
1. ✅ Check if Ollama is running
2. ✅ Verify required Ollama models are installed
3. ✅ Check if ports 8000 and 5173 are available
4. ✅ Start the Python FastAPI backend (port 8000)
5. ✅ Wait for backend health check to pass
6. ✅ Start the Svelte frontend dev server (port 5173)
7. ✅ Wait for frontend to be ready
8. ✅ Open your default browser to `http://localhost:5173`
9. ✅ Monitor both servers and handle graceful shutdown on Ctrl+C

## 🌐 Accessing the Application

Once started, access the application at:
- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs (FastAPI Swagger UI)

## 🛑 Stopping the Application

Press **Ctrl+C** in the terminal window where the launcher is running.

The launcher will automatically:
- Stop the frontend server
- Stop the backend server
- Clean up any temporary processes

## 🔧 Troubleshooting

### Ollama Not Running
**Error**: `❌ Ollama is not running or not accessible`

**Solution**:
- Start Ollama: `ollama serve` (in a separate terminal)
- Or launch the Ollama desktop application
- Verify with: `curl http://localhost:11434/api/tags`

### Missing Ollama Models
**Error**: `⚠️ Missing required Ollama models`

**Solution**:
```bash
ollama pull huihui_ai/qwen3-vl-abliterated:4b-instruct
ollama pull huihui_ai/qwen3-vl-abliterated:8b-thinking
```

### Port Already in Use
**Error**: `⚠️ Port 8000 is already in use`

**Solution**:
- Check if backend is already running: `curl http://localhost:8000/health`
- Kill the process using the port:
  - Windows: `netstat -ano | findstr :8000` then `taskkill /PID <pid> /F`
  - Linux/macOS: `lsof -ti:8000 | xargs kill -9`

### Virtual Environment Not Found
**Error**: `❌ Virtual environment not found`

**Solution**: Set up the virtual environment (see Prerequisites section above)

### Frontend Dependencies Missing
**Error**: `⚠️ Node modules not found`

**Solution**:
```bash
cd frontend
npm install
```

Or let the launcher install them automatically (it will prompt).

### Backend Fails to Start
**Possible Causes**:
1. Python dependencies not installed → `pip install -r requirements.txt`
2. Ollama not running → Start Ollama first
3. Port 8000 in use → Stop conflicting process
4. YOLO model missing → Check `backend/models/comic-speech-bubble-detector.pt` exists

### Frontend Fails to Start
**Possible Causes**:
1. Node modules not installed → `npm install` in frontend folder
2. Port 5173 in use → Stop conflicting process (often another Vite server)
3. npm not found → Install Node.js

## 🔨 Manual Startup (Fallback)

If the launcher scripts don't work, you can start manually:

### Terminal 1 - Backend:
```bash
cd backend
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

uvicorn main:app --host 0.0.0.0 --port 8000
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
```

### Terminal 0 - Ollama (if not running):
```bash
ollama serve
```

## 📁 Project Structure

```
manga-helper/
├── start.bat          # Windows batch launcher (double-click)
├── start.ps1          # PowerShell launcher (advanced features)
├── start.py           # Cross-platform Python launcher
├── package.json       # NPM scripts for convenience
├── DEPLOYMENT.md      # This file
├── backend/           # Python FastAPI server
│   ├── main.py
│   ├── requirements.txt
│   ├── venv/          # Python virtual environment
│   └── models/        # YOLO model files
└── frontend/          # Svelte + Vite application
    ├── src/
    ├── package.json
    └── node_modules/
```

## 🎨 Features

- **One-click startup** for both backend and frontend
- **Health checks** ensure servers are ready before opening browser
- **Port validation** prevents conflicts
- **Ollama verification** ensures AI models are available
- **Graceful shutdown** with Ctrl+C
- **Cross-platform support** (Windows, Linux, macOS)
- **Colored terminal output** for better visibility
- **Error messages** with actionable solutions

## 📝 Environment Variables (Optional)

### Backend
No environment variables required. Backend runs with sensible defaults.

### Frontend
Create `frontend/.env` (optional):
```env
VITE_API_BASE_URL=http://localhost:8000
```

Default value works without `.env` file thanks to Vite proxy configuration.

## 🐛 Debug Mode

For detailed logs, you can run components separately:

**Backend with reload:**
```bash
cd backend
venv\Scripts\activate  # or source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend with debug info:**
```bash
cd frontend
npm run dev -- --debug
```

## 🆘 Getting Help

If you encounter issues:
1. Check this troubleshooting guide
2. Verify all prerequisites are installed
3. Try manual startup to isolate the problem
4. Check backend logs for errors
5. Check frontend console for errors

## 🔄 Updating Dependencies

**Backend:**
```bash
cd backend
venv\Scripts\activate  # or source venv/bin/activate
pip install -r requirements.txt --upgrade
```

**Frontend:**
```bash
cd frontend
npm update
```

## 🚀 Production Deployment

For production deployment:
1. Build frontend: `cd frontend && npm run build`
2. Serve with production server (not `npm run dev`)
3. Use proper WSGI server for backend (gunicorn, etc.)
4. Set up reverse proxy (nginx, apache)
5. Configure SSL certificates
6. Set production environment variables

The launcher scripts are designed for **development use only**.

## ✅ Checklist for First-Time Setup

- [ ] Install Ollama
- [ ] Pull required Ollama models
- [ ] Install Python 3.8+
- [ ] Install Node.js 18+
- [ ] Create backend virtual environment
- [ ] Install backend dependencies (`pip install -r requirements.txt`)
- [ ] Install frontend dependencies (`npm install` in frontend/)
- [ ] Verify YOLO model exists (`backend/models/comic-speech-bubble-detector.pt`)
- [ ] Start Ollama service
- [ ] Run launcher script (`start.bat`, `start.ps1`, or `python start.py`)
- [ ] Access application at http://localhost:5173

Enjoy using Manga-Helper! 📚✨
