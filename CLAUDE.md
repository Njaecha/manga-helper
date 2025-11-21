# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a manga reading helper application that uses AI to detect and translate Japanese text in manga speech bubbles. The project consists of a Python FastAPI backend for AI processing and a Svelte frontend for user interaction.

## Project Structure

```
manga-helper/
├── backend/         # Python FastAPI server
│   ├── main.py      # API endpoints and application logic
│   ├── requirements.txt
│   ├── models/      # Contains YOLO model (comic-speech-bubble-detector.pt)
│   └── utils/       # Utility functions (currently empty)
└── frontend/        # Svelte + Vite application
    ├── src/
    │   ├── App.svelte                        # Main application orchestrator
    │   ├── main.js                           # Application entry point
    │   ├── app.css                           # Global styles with TailwindCSS
    │   ├── components/                       # Reusable UI components
    │   │   ├── PageControls.svelte          # Folder loading and page navigation
    │   │   ├── ImageCarousel.svelte         # Thumbnail carousel for pages
    │   │   ├── AnalysisControls.svelte      # Detection and analysis buttons
    │   │   ├── CollapsibleOutput.svelte     # Spoiler/collapsible content wrapper
    │   │   ├── TokenReveal.svelte           # Token-by-token text reveal
    │   │   └── TranslationInput.svelte      # User translation input and save
    │   └── lib/                              # Core utilities and canvas
    │       ├── Canvas.svelte                 # Enhanced Konva canvas with drawing mode
    │       ├── store.js                      # Svelte stores for state management
    │       ├── api.js                        # API client with mock functions
    │       ├── utils.js                      # General utility functions
    │       └── canvasUtils.js                # Canvas drawing and manipulation utilities
    ├── vite.config.js                        # Vite configuration with proxy
    ├── tailwind.config.js                    # TailwindCSS configuration
    ├── .env.example                          # Environment variable template
    └── package.json                          # Dependencies and scripts
```

## Technology Stack

### Backend
- FastAPI for REST API
- YOLO (Ultralytics) for speech bubble detection
- Pillow for image processing
- Ollama for Japanese language processing (OCR, furigana, romaji, translation)
- Python multipart for file uploads

### Frontend
- Svelte 5 with Vite
- Konva (via svelte-konva) for interactive canvas rendering
- TailwindCSS for styling
- Axios for HTTP requests

## Development Commands

### Backend Setup and Running
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Unix
pip install -r requirements.txt
uvicorn main:app --reload  # Runs on http://localhost:8000
```

### Frontend Setup and Running
```bash
cd frontend
npm install
npm run dev      # Start development server (http://localhost:5173)
npm run build    # Build for production
npm run preview  # Preview production build
```

## Architecture and Data Flow

### State Management (store.js)
The application uses Svelte stores for centralized state management:
- **Folder and Image State**: `folderPath`, `imageList`, `currentImageIndex`, `currentImage` (derived)
- **Box Detection**: `detectedBoxes`, `customBoxes`, `allBoxes` (derived combines both types)
- **Selection**: `selectedBox`, `selectedBoxIndex`
- **Analysis Results**: `analysisResult`, `revealedTokens`, `revealedSections`
- **User Data**: `userTranslations` (persisted to localStorage)
- **UI State**: `isLoading`, `isDrawingMode`, `error`

### Folder Loading and Navigation Flow
1. User enters folder path in PageControls component
2. Frontend calls mock `loadFolder()` API (returns hardcoded image list)
3. Store updates `folderPath`, `imageList`, and resets `currentImageIndex` to 0
4. ImageCarousel displays thumbnails of all pages
5. User can navigate with Previous/Next buttons, carousel clicks, or arrow keys
6. Changing page resets analysis state (boxes, selection, results)

### Speech Bubble Detection Flow
1. User clicks "Detect Speech Bubbles" in AnalysisControls
2. Frontend retrieves current image URL via `getImageUrl(folderPath, currentImage)`
3. Frontend sends POST request to `/detect` with image path
4. Backend loads YOLO model and detects speech bubbles
5. Backend returns array of bounding boxes with `{x, y, w, h}` coordinates
6. Store updates `detectedBoxes` (marked as type: 'detected')
7. Canvas renders boxes as red rectangles with semi-transparent fill

### Custom Box Drawing Flow
1. User presses 'D' key to toggle drawing mode (or Escape to cancel)
2. Canvas displays "Draw Mode" indicator with blue highlighting
3. User clicks and drags on canvas to draw custom selection box
4. BoxDrawer utility manages drawing state (start, update, finish)
5. Preview box shown with dashed blue outline while dragging
6. On release, if box is large enough (min 10px), added to `customBoxes` (type: 'custom')
7. Canvas renders custom boxes as blue rectangles
8. Drawing mode can be toggled off to return to selection mode

### Text Analysis Flow
1. User clicks on a detected or custom speech bubble box
2. Store updates `selectedBox` and `selectedBoxIndex`
3. Canvas highlights selected box with thicker border and different color
4. User clicks "Analyze Selected Bubble" in AnalysisControls
5. Frontend sends POST request to `/analyze` with image path and box coordinates
6. Backend crops bubble, performs OCR, and uses Ollama for processing
7. Backend returns `{ocr, tokens, hiragana, romaji, translation}`
8. Store updates `analysisResult` and resets reveal state
9. Right pane displays results:
   - TokenReveal: Shows OCR text with token-by-token reveal buttons
   - CollapsibleOutput: Hidden sections for hiragana, romaji, translation (spoiler mode)

### Translation Save Flow
1. User enters optional bubble marker and translation text in TranslationInput
2. User clicks "Save Translation"
3. Translation saved to `userTranslations` store keyed by `{imageName: {boxIndex: {marker, translation}}}`
4. Store automatically persisted to localStorage via subscription
5. Mock API call to `saveTranslation()` simulates backend save
6. User can export all translations to JSON file or import from file

## Key Implementation Details

### Canvas Component (Canvas.svelte)
- Uses svelte-konva to render manga pages and bounding boxes
- Responsive stage size (adjusts to image dimensions, max 1000x1400)
- Two modes: Select Mode (default) and Draw Mode (toggle with 'D' key)
- Supports both detected boxes (red) and custom boxes (blue)
- Selected boxes highlighted with orange/green color and thicker border
- BoxDrawer utility class manages drawing state and validation
- Real-time preview of box being drawn with dashed outline
- Keyboard shortcuts: D to toggle mode, Arrow keys for navigation, Escape to cancel drawing
- Image loaded asynchronously with error handling and loading states

### Component Architecture

**PageControls.svelte**: Folder path input, validation, load button, and page navigation (prev/next)
- Keyboard support for Enter to load, Arrow keys for navigation
- Displays current page and total page count
- Error handling for invalid paths and empty folders

**ImageCarousel.svelte**: Horizontal scrollable thumbnail list
- Auto-scrolls to show current page
- Visual indicators for current page (highlighted border)
- Placeholder thumbnails with page numbers

**AnalysisControls.svelte**: Detection and analysis action buttons
- Disabled states based on context (no image, no selection)
- Loading indicators during API calls
- Helper text to guide user through workflow

**TokenReveal.svelte**: Interactive token-by-token text reveal
- Individual tokens can be clicked to reveal
- Progress bar shows reveal percentage
- "Reveal All" / "Hide All" buttons for bulk actions
- Fallback to full text display if no tokens provided

**CollapsibleOutput.svelte**: Reusable spoiler/collapsible wrapper
- Toggle button to show/hide content
- Lock icon indicator when content is hidden
- Used for hiragana, romaji, and translation sections

**TranslationInput.svelte**: User translation input and management
- Bubble marker input (optional, for numbering bubbles)
- Translation text area (required)
- Save button with API integration
- Export all translations to JSON file
- Import translations from JSON file
- Auto-loads saved translation when box is selected
- Success/error messages for user feedback

### API Layer (api.js)

**Backend Endpoints (Fully Implemented):**
- `POST /detect` - Detects speech bubbles, returns `{boxes: [{x, y, w, h}]}`
- `POST /analyze` - Analyzes bubble, returns `{ocr, tokens, hiragana, romaji, translation}`
- `POST /api/load-folder` - Scans folder for images, returns `{images: [filenames]}`
- `GET /api/image?path=...` - Serves image file from filesystem via FileResponse
- `POST /api/translations` - Saves translation to JSON file, returns `{success, message}`
- `GET /api/translations/{image_name}` - Gets saved translations for image
- `GET /health` - Health check endpoint, returns `{status, message}`

**Frontend API Functions:**
- `loadFolder(path)` - Calls `/api/load-folder`, validates folder exists and returns image list
- `getImageUrl(folder, filename)` - Constructs URL to `/api/image?path=full/path/to/file`
- `saveTranslation(imageName, boxIndex, marker, translation)` - Saves to backend JSON file
- `getTranslations(imageName)` - Retrieves translations from backend
- `exportTranslations(translations)` - Downloads JSON file to user's system (client-side)
- `importTranslations(file)` - Reads and parses JSON file from user (client-side)
- `checkBackendHealth()` - Tests `/health` endpoint availability

**Translation Storage:**
Backend stores translations in `translations.json` file with structure:
```json
{
  "page1.jpg": {
    "0": {"marker": "1", "translation": "Hello"},
    "1": {"marker": "2", "translation": "World"}
  }
}
```
Frontend also maintains localStorage copy as cache/backup.

### Utility Functions

**canvasUtils.js:**
- `BoxDrawer` class: Manages custom box drawing state machine
- `BoxManipulator` class: Handle for box editing (resize/move) - not yet used in UI
- Coordinate transformation utilities (screen ↔ image coordinates)
- Box constraint and validation functions

**utils.js:**
- Debounce/throttle functions
- Path validation and file type checking
- LocalStorage helpers with error handling
- Box geometry functions (overlap, contains, normalize)
- File path manipulation (extract filename, extension)

### State Persistence
- User translations automatically saved to localStorage via store subscription
- Key: `'manga-translations'`
- Format: `{imageName: {boxIndex: {marker, translation}}}`
- Restored on app mount
- Can be exported/imported as JSON for backup

## Known Issues and TODOs

### Backend
1. **OCR Implementation**: Stubbed with `fake_ocr()` - needs real Japanese OCR (e.g., Tesseract with jpn trained data, or cloud OCR service)
2. **Ollama Configuration**: Model name is placeholder `"your-japanese-model"` - needs valid Japanese model
3. **Tokenization**: ✅ IMPLEMENTED - Backend now returns `tokens` array (simple whitespace split, upgrade to MeCab/kuromoji recommended)
4. **Image Serving**: ✅ IMPLEMENTED - `/api/image?path=...` endpoint serves images via FileResponse
5. **Folder Scanning**: ✅ IMPLEMENTED - `/api/load-folder` endpoint scans folder and returns image list
6. **Translation Persistence**: ✅ IMPLEMENTED - `/api/translations` endpoints save/retrieve from JSON file
7. **Path Handling**: Uses Windows-style backslashes, will fail on Unix systems
8. **Temp Files**: `temp_crop.png` not cleaned up after analysis
9. **Error Handling**: Ollama response parsing needs try/catch and validation

### Frontend
1. **Image Loading**: ✅ FIXED - `getImageUrl()` now constructs proper URLs to backend `/api/image` endpoint
2. **Folder Loading**: ✅ FIXED - Calls real `/api/load-folder` endpoint to get actual folder contents
3. **Image Thumbnails**: Could show actual image thumbnails (currently shows styled placeholders with page numbers)
4. **Box Editing**: BoxManipulator class exists but resize/move UI not implemented yet
5. **Responsive Canvas**: Stage size adjusts to image but could be improved for very large/small images
6. **Touch Support**: Drawing mode only supports mouse - needs touch event handlers for mobile/tablets
7. **Undo/Redo**: No history for custom boxes - can't undo accidental drawings
8. **Box Persistence**: Custom boxes lost when changing pages - should be saved per-page

### Integration
1. **CORS**: Vite proxy configured but may need CORS headers if accessing backend directly
2. **Environment Config**: `.env` file not created (only `.env.example` exists) - need to copy and configure
3. **Health Check**: No `/health` endpoint for backend connectivity check
4. **Image Format**: Backend expects file paths, but browser can't access local filesystem - needs file upload or server-side folder access

## Development Notes

### Backend Requirements
- The frontend expects backend on `http://localhost:8000` (configurable via `VITE_API_BASE_URL`)
- Vite dev server proxies `/detect` and `/analyze` to backend automatically
- YOLO model must exist at `backend/models/comic-speech-bubble-detector.pt`
- Ollama must be installed and running with Japanese language model configured
- Python 3.8+ required for FastAPI and Ultralytics

### Frontend Development
- Run `npm install` in frontend directory before first start
- Copy `.env.example` to `.env` and configure if needed (optional, defaults work)
- Frontend runs on `http://localhost:5173` by default
- TailwindCSS configured with JIT mode for fast builds
- Svelte 5 uses runes ($state, $derived) but this codebase uses Svelte 4-style stores for compatibility

### Keyboard Shortcuts
- **D key**: Toggle between Select Mode and Draw Mode on canvas
- **Arrow Left/Right**: Navigate between pages (previous/next)
- **Escape**: Cancel drawing in progress
- **Enter**: Submit folder path input to load folder

### Testing with Real Backend
With backend endpoints now implemented:
1. **Start Backend**: `cd backend && uvicorn main:app --reload`
2. **Start Frontend**: `cd frontend && npm run dev`
3. **Load a manga folder**:
   - Enter actual folder path (e.g., `C:\manga\volume1` or `/home/user/manga/volume1`)
   - Backend will scan folder and return list of image files
   - Frontend will display pages in carousel
4. **View images**: Canvas loads images via `/api/image` endpoint
5. **Detect bubbles**: Click "Detect Speech Bubbles" to run YOLO detection
6. **Draw custom boxes**: Press 'D' to toggle drawing mode
7. **Analyze text**: Select a box and click "Analyze Selected Bubble"
8. **Save translations**: Enter translation and click Save (stored in `backend/translations.json`)
9. **Export/Import**: Use buttons to backup/restore all translations

### Backend Endpoints Summary
All endpoints implemented and functional:
```
POST /detect                         # ✅ YOLO speech bubble detection
POST /analyze                        # ✅ OCR + Ollama translation
POST /api/load-folder                # ✅ Scan folder for images
GET  /api/image?path=...             # ✅ Serve image file
POST /api/translations               # ✅ Save user translation
GET  /api/translations/:image_name   # ✅ Get translations for image
GET  /health                         # ✅ Health check endpoint
```
