from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from ollama import chat
from pydantic import BaseModel

app = FastAPI()

class ChatRequest(BaseModel):
    model: str = "huihui_ai/qwen3-vl-abliterated:8b-thinking"
    message: str

@app.post("/chat/stream")
async def stream_chat(request: ChatRequest):
    async def generate():
        stream = chat(
            model=request.model,
            messages=[{'role': 'user', 'content': request.message}],
            stream=True,
        )
        
        for chunk in stream:
            content = chunk['message']['content']
            # Send as Server-Sent Events format
            yield f"data: {content}\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


# Alternative: Simple text streaming (no SSE format)
@app.post("/chat/stream-text")
async def stream_chat_text(request: ChatRequest):
    async def generate():
        stream = chat(
            model=request.model,
            messages=[{'role': 'user', 'content': request.message}],
            stream=True,
        )
        
        for chunk in stream:
            yield chunk['message']['content']
    
    return StreamingResponse(generate(), media_type="text/plain")

