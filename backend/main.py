from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
from ultralytics import YOLO
import ollama
from ollama import ChatResponse
import os
import json
from pathlib import Path
from typing import Optional, List
from urllib.parse import unquote
from utils.llm import ocr_image, chop, stream_translation, stream_translation_multiple, word_information

app = FastAPI()

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage for translations (in production, use a database)
TRANSLATIONS_FILE = None
CROP_FOLDER = "crops"
THUMBNAIL_FOLDER = "thumbnails"
Path(CROP_FOLDER).mkdir(exist_ok=True)
Path(THUMBNAIL_FOLDER).mkdir(exist_ok=True)

# --- Load YOLO model ---
model = YOLO(".\\models\\comic-speech-bubble-detector.pt")

class DetectRequest(BaseModel):
    image: str  # path or url


class AnalyzeRequest(BaseModel):
    image: str
    box: dict

class AnalyzeMultipleRequest(BaseModel):
    image: str
    boxes: List[dict]  # Array of boxes in selection order

class TranslateRequest(BaseModel):
    image: str
    box: dict
    ocr_text: str

class TranslateMultipleRequest(BaseModel):
    image: str
    boxes: List[dict]
    ocr_texts: List[str]

class LoadFolderRequest(BaseModel):
    folder_path: str


class SaveTranslationRequest(BaseModel):
    image_name: str
    box_index: int
    marker: Optional[str] = ""
    translation: str
    original_text: str

class InfoRequest(BaseModel):
    image: str
    word: str


def image_path_from_url(url: str) -> str:
    if not url.startswith("http://localhost:8000/api/image?path="):
        return url  # Assume it's a direct path
    return unquote(url.replace("http://localhost:8000/api/image?path=", ""))

def img_and_crop(req: AnalyzeRequest | TranslateRequest) -> tuple[Image.Image, str, Image.Image, str]:
    image_path = image_path_from_url(req.image)
    img = Image.open(image_path)
    x, y, w, h = req.box["x"], req.box["y"], req.box["w"], req.box["h"]
    crop = img.crop((x, y, x + w, y + h))
    crop_path = f"{CROP_FOLDER}/temp_crop.png"
    crop.save(crop_path)
    return img, image_path, crop, crop_path

@app.post("/detect")
def detect(req: DetectRequest):
    img = Image.open(image_path_from_url(req.image))
    results = model(img)

    boxes = []
    for r in results[0].boxes:
        x1, y1, x2, y2 = r.xyxy[0].tolist()
        boxes.append({
            "x": x1,
            "y": y1,
            "w": x2 - x1,
            "h": y2 - y1
        })

    return {"boxes": boxes}


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    """
    Analyze a speech bubble and return tokenized OCR, hiragana, romaji.
    Returns three parallel token arrays where each index corresponds across all three.

    Response format:
    {
        "ocr_tokens": ["この", "箱", "は"],
        "hiragana_tokens": ["この", "はこ", "は"],
        "romaji_tokens": ["kono", "hako", "wa"],
    }
    """
    # 1. Crop bubble
    page, page_path, crop, crop_path = img_and_crop(req=req)
    ocr_text = ocr_image(crop_path)
    ocr_text = ocr_text.replace("\n", "")

    tokens, hiragana, romanji =  chop(text=ocr_text)

    response = {
        "ocr_text": ocr_text,
        "ocr_tokens": tokens,
        "hiragana_tokens": hiragana,
        "romaji_tokens": romanji
    }

    return response


@app.post("/analyze-multiple")
def analyze_multiple(req: AnalyzeMultipleRequest):
    """
    Analyze multiple speech bubbles in order and return combined tokens with bubble metadata.

    Response format:
    {
        "ocr_tokens": [
            {"text": "この", "bubbleIndex": 0},
            {"text": "箱", "bubbleIndex": 0},
            {"type": "separator", "bubbleIndex": 0},
            {"text": "それ", "bubbleIndex": 1},
            ...
        ],
        "hiragana_tokens": [...],
        "romaji_tokens": [...],
        "bubbleBreakdown": [
            {
                "bubbleIndex": 0,
                "ocr_text": "この箱",
                "ocr_tokens": ["この", "箱"],
                "hiragana_tokens": ["この", "はこ"],
                "romaji_tokens": ["kono", "hako"]
            },
            ...
        ]
    }
    """
    image_path = image_path_from_url(req.image)
    page = Image.open(image_path)

    all_ocr_tokens = []
    all_hiragana_tokens = []
    all_romaji_tokens = []
    bubble_breakdown = []

    for bubble_idx, box in enumerate(req.boxes):
        # Crop bubble
        x, y, w, h = box["x"], box["y"], box["w"], box["h"]
        crop = page.crop((x, y, x + w, y + h))
        crop_path = f"{CROP_FOLDER}/bubble_{bubble_idx}.png"
        crop.save(crop_path)

        # OCR and tokenize
        ocr_text = ocr_image(crop_path)
        ocr_text = ocr_text.replace("\n", "")

        print(f"[ANALYZE-MULTI] Bubble {bubble_idx} OCR Text: '{ocr_text}'")

        tokens, hiragana, romanji = chop(text=ocr_text)

        print(f"[ANALYZE-MULTI] Bubble {bubble_idx} Tokens: {tokens}")

        # Add to combined arrays with bubble index
        for t, h, r in zip(tokens, hiragana, romanji):
            all_ocr_tokens.append({"text": t, "bubbleIndex": bubble_idx})
            all_hiragana_tokens.append({"text": h, "bubbleIndex": bubble_idx})
            all_romaji_tokens.append({"text": r, "bubbleIndex": bubble_idx})

        # Add separator between bubbles (except after last)
        if bubble_idx < len(req.boxes) - 1:
            separator = {"type": "separator", "bubbleIndex": bubble_idx}
            all_ocr_tokens.append(separator)
            all_hiragana_tokens.append(separator)
            all_romaji_tokens.append(separator)

        # Store breakdown
        bubble_breakdown.append({
            "bubbleIndex": bubble_idx,
            "ocr_text": ocr_text,
            "ocr_tokens": tokens,
            "hiragana_tokens": hiragana,
            "romaji_tokens": romanji
        })

    response = {
        "ocr_tokens": all_ocr_tokens,
        "hiragana_tokens": all_hiragana_tokens,
        "romaji_tokens": all_romaji_tokens,
        "bubbleBreakdown": bubble_breakdown
    }

    print(f"[ANALYZE-MULTI] Sending response with {len(req.boxes)} bubbles")

    return response


@app.post("/translate")
async def translate(req: TranslateRequest):
    """
    A streaming API endpoint for translation of a given speechbubble.
    The response includes thinking.
    """
    page, page_path, crop, crop_path = img_and_crop(req=req)
    return StreamingResponse(stream_translation(page_path, crop_path, req.ocr_text), media_type="text/plain")


@app.post("/translate-multiple")
async def translate_multiple(req: TranslateMultipleRequest):
    """
    A streaming API endpoint for translation of multiple speechbubbles.
    Treats all bubbles as a connected conversation or sentence continuation.
    """
    image_path = image_path_from_url(req.image)
    page = Image.open(image_path)

    # Create crops for all bubbles
    crop_paths = []
    for bubble_idx, box in enumerate(req.boxes):
        x, y, w, h = box["x"], box["y"], box["w"], box["h"]
        crop = page.crop((x, y, x + w, y + h))
        crop_path = f"{CROP_FOLDER}/bubble_{bubble_idx}.png"
        crop.save(crop_path)
        crop_paths.append(crop_path)

    return StreamingResponse(
        stream_translation_multiple(image_path, crop_paths, req.ocr_texts),
        media_type="text/plain"
    )


@app.post("/word")
def info(req: InfoRequest):
    """
    Get information about what the given word can mean.
    """
    image_path = image_path_from_url(req.image)
    response = word_information(req.word, image_path)
    return {
        "info": response
    }
    

@app.post("/api/load-folder")
def load_folder(req: LoadFolderRequest):
    """
    Load all image files from a folder path
    Returns list of image filenames
    """
    global TRANSLATIONS_FILE
    folder_path = req.folder_path

    # Validate folder exists
    if not os.path.exists(folder_path):
        raise HTTPException(status_code=404, detail=f"Folder not found: {folder_path}")

    if not os.path.isdir(folder_path):
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {folder_path}")

    TRANSLATIONS_FILE = os.path.join(folder_path, "translation.json")

    # Get all image files in the folder
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
    images = []

    try:
        for filename in sorted(os.listdir(folder_path)):
            file_path = os.path.join(folder_path, filename)
            if os.path.isfile(file_path):
                ext = os.path.splitext(filename)[1].lower()
                if ext in image_extensions:
                    images.append(filename)
    except PermissionError:
        raise HTTPException(status_code=403, detail=f"Permission denied: {folder_path}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading folder: {str(e)}")

    if not images:
        raise HTTPException(status_code=404, detail=f"No images found in folder: {folder_path}")

    return {"images": images}


@app.get("/api/image")
def get_image(path: str):
    """
    Serve an image file from the filesystem
    Query parameter 'path' should be the full path to the image
    Example: /api/image?path=C:/manga/volume1/page1.jpg
    """
    # Decode and validate path
    if not path:
        raise HTTPException(status_code=400, detail="Path parameter is required")

    # Security: Check if file exists and is a file
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Image not found: {path}")

    if not os.path.isfile(path):
        raise HTTPException(status_code=400, detail=f"Path is not a file: {path}")

    # Validate it's an image file
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
    ext = os.path.splitext(path)[1].lower()
    if ext not in image_extensions:
        raise HTTPException(status_code=400, detail=f"File is not an image: {path}")

    # Return the file with proper CORS headers
    return FileResponse(
        path,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
            "Access-Control-Allow-Headers": "*"
        }
    )


@app.get("/api/thumbnail")
def get_thumbnail(path: str, width: int = 120, height: int = 160):
    """
    Generate and serve thumbnail for an image
    Query parameters:
    - path: Full path to the image file
    - width: Maximum width for thumbnail (default: 120)
    - height: Maximum height for thumbnail (default: 160)

    Thumbnails are cached in the thumbnails/ folder to avoid regeneration.
    Example: /api/thumbnail?path=C:/manga/volume1/page1.jpg&width=120&height=160
    """
    import hashlib

    # Validate path
    if not path:
        raise HTTPException(status_code=400, detail="Path parameter is required")

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail=f"Image not found: {path}")

    if not os.path.isfile(path):
        raise HTTPException(status_code=400, detail=f"Path is not a file: {path}")

    # Validate it's an image file
    image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
    ext = os.path.splitext(path)[1].lower()
    if ext not in image_extensions:
        raise HTTPException(status_code=400, detail=f"File is not an image: {path}")

    # Create cache key from path and dimensions
    cache_key = hashlib.md5(f"{path}_{width}_{height}".encode()).hexdigest()
    thumb_path = os.path.join(THUMBNAIL_FOLDER, f"{cache_key}.jpg")

    # Return cached thumbnail if exists
    if os.path.exists(thumb_path):
        return FileResponse(
            thumb_path,
            media_type="image/jpeg",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "*"
            }
        )

    # Generate thumbnail
    try:
        img = Image.open(path)

        # Use thumbnail() method which maintains aspect ratio
        img.thumbnail((width, height), Image.Resampling.LANCZOS)

        # Convert RGBA to RGB if necessary (for JPEG)
        if img.mode == 'RGBA':
            # Create white background
            rgb_img = Image.new('RGB', img.size, (255, 255, 255))
            rgb_img.paste(img, mask=img.split()[3])  # Use alpha channel as mask
            img = rgb_img
        elif img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')

        # Save to cache with optimization
        img.save(thumb_path, "JPEG", quality=85, optimize=True)

        return FileResponse(
            thumb_path,
            media_type="image/jpeg",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET",
                "Access-Control-Allow-Headers": "*"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating thumbnail: {str(e)}")

@app.post("/api/translations")
def save_translation(req: SaveTranslationRequest):
    """
    Save a user translation for a specific bubble
    Stores in JSON file
    """

    # Load existing translations
    translations = {}
    if os.path.exists(TRANSLATIONS_FILE):
        try:
            with open(TRANSLATIONS_FILE, 'r', encoding='utf-8') as f:
                translations = json.load(f)
        except Exception as e:
            print(f"Error loading translations: {e}")

    # Create structure if needed
    if req.image_name not in translations:
        translations[req.image_name] = {}

    # Save translation
    translations[req.image_name][str(req.box_index)] = {
        "marker": req.marker,
        "original": req.original_text,
        "translation": req.translation
    }

    # Write back to file
    try:
        with open(TRANSLATIONS_FILE, 'w', encoding='utf-8') as f:
            json.dump(translations, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving translation: {str(e)}")

    return {"success": True, "message": "Translation saved successfully"}


@app.get("/api/translations/{image_name}")
def get_translations(image_name: str):
    """
    Get all saved translations for a specific image
    Returns dict of {boxIndex: {marker, translation}}
    """
    # Load translations
    if not os.path.exists(TRANSLATIONS_FILE):
        return {}

    try:
        with open(TRANSLATIONS_FILE, 'r', encoding='utf-8') as f:
            translations = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading translations: {str(e)}")

    # Return translations for this image (or empty dict if none)
    return translations.get(image_name, {})


@app.get("/health")
def health_check():
    """
    Health check endpoint for frontend to verify backend is running
    """
    return {"status": "healthy", "message": "Backend is running"}


def fake_ocr(_):
    return "これはテストです"
