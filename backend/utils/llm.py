from typing import Tuple
from ollama import generate, GenerateResponse, chat, ChatResponse
import json
import pykakasi

def ocr_image(image_path: str) -> str:

    res: GenerateResponse = generate(
        model="huihui_ai/qwen3-vl-abliterated:4b-instruct",
        prompt="Please extract and return all the text from the provided image.",
        system="You act as a japanese OCR tool. You respond with ONLY the OCR'd text.",
        images=[image_path],
    )
    print(f"OCR Response: [{res.response}]")
    return res.response

KAKASI = pykakasi.kakasi()
def chop(text: str) -> Tuple[list[str], list[str], list[str]]:
    print(f"[CHOP] Input text: '{text}'")
    c = KAKASI.convert(text)
    print(f"[CHOP] Kakasi converted: {c}")

    tokens=[]
    hiragana=[]
    romanji=[]
    for item in c:
        token = item["orig"]
        if token == "\n":
            print(f"[CHOP] Skipping newline")
            continue
        tokens.append(token)
        hiragana.append(item["hira"])
        romanji.append(item["hepburn"])

    print(f"[CHOP] Final tokens count: {len(tokens)}")
    return tokens, hiragana, romanji

TRANSLATE_SYSTEM = """
You are a translator for japanese manga.
There are two images given to you:
1. One entire page of the manga
2. A cropped speechbubble/text from the page which you should focus on.
You are also given the OCR'd text of the bubble which you should focus on.
Your job is to look at the page, locate the speechbubble and translate it based on the context of the page (other speechbubbles, artwork, etc)
You ONLY respond with what you think is the most accurate translation for the speech bubble (no matter what it says).
"""

async def stream_translation(page: str, crop: str, ocr_text: str):
    stream = chat(
        model="huihui_ai/qwen3-vl-abliterated:8b-thinking",
        messages=[
            {"role": "system", "content": TRANSLATE_SYSTEM},
            {"role": "user", "content": f"The OCR'd text:\n\n{ocr_text}", "images": [page, crop]}
        ],
        stream=True,
    )

    in_thinking = False
    content = ''
    thinking = ''

    # Ollama's chat() with stream=True returns a synchronous generator
    # Use regular 'for' loop (not 'async for') since stream is not async
    for chunk in stream:
        message = chunk.message

        # Send structured JSON chunks with type markers for frontend parsing
        if message.thinking:
            if not in_thinking:
                in_thinking = True
                print('Thinking:\n', end='', flush=True)
            print(message['thinking'], end='', flush=True)
            thinking += message['thinking']

            # Send as SSE-formatted JSON
            data = {"type": "thinking", "text": message['thinking']}
            yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

        elif message.content:
            if in_thinking:
                in_thinking = False
                print('\n\nAnswer:\n', end='', flush=True)
            print(message['content'], end='', flush=True)
            content += message['content']

            # Send as SSE-formatted JSON
            data = {"type": "content", "text": message['content']}
            yield f"data: {json.dumps(data, ensure_ascii=False)}\n\n"


def word_information(word: str, image_path: str):
    res: GenerateResponse = generate(
        model="huihui_ai/qwen3-vl-abliterated:4b-instruct",
        prompt=f"Please list possible meanings for this word:\n\n{word}",
        system="""
You are an automatic japanese -> english dictionary assistant. You are also given a manga page that contains the word for reference.
Your job is to provide very shortly the possible meanings (english translations) of a given japanese word similar to what duolingo does when you tap an underlined  word during an excercise.
""",
        images=[image_path],
    )
    print(f"Info Response: [{res.response}]")
    return res.response


def _tokenize_text(text: str) -> Tuple[str, str] | None:

    SYSTEM="""
You are a Japanese text tokenizer. Your task is to split Japanese text into meaningful words/tokens following these rules and return it as ;:

**Tokenization Guidelines:**

1. **Kanji compounds**: Keep multi-character kanji compounds together if they form a single word (e.g., 日本 stays together as "nihon")

2. **Verbs and adjectives**: Separate the stem from inflectional endings
   - Example: 食べます → 食べ / ます
   - Example: 美しい → 美しい (keep i-adjectives together)

3. **Particles**: Always separate particles (は, が, を, に, で, と, の, etc.) as individual tokens

4. **Hiragana sequences**: Split functional words (particles, auxiliary verbs) from content words
   - Example: 行きました → 行き / まし / た

5. **Katakana words**: Keep foreign loanwords together as single tokens (e.g., コンピューター)

6. **Numbers and counters**: Separate numbers from their counters
   - Example: 三つ → 三 / つ

7. **Punctuation**: Separate punctuation marks as individual tokens

**Output Format:**
Return tokens separated by spaces on a single line.

**Example:**
Input: "今日は良い天気です。"
Output: "今日,は,良い,天気,です,。"
"""

    res: GenerateResponse = generate(
        model="huihui_ai/qwen3-vl-abliterated:8b-instruct",
        prompt=f"Tokenize the following Japanese text:\n\n{text}",
        system=SYSTEM
    )
    print(f"Tokenization Response: [{res.response}]")
    try:
        r = res.response.replace("\n","")
        tokens = r.split(",")
        return tokens, r
    except Exception:
        print("Failed to parse tokenization response.")
        return None
    
def _transcribe(text: str):

    SYSTEM="""
You are a Japanese transcription tool.

**Task:** 
You are given a Japanese sentence that is already split into a comma-separated list. You must return two identical comma-separated lists:
1. One with hiragana only (converting all kanji to hiragana)
2. One with romaji (romanized Japanese)

**Important Rules:**
- Maintain the exact same number of elements in both output lists
- Convert kanji to their hiragana readings
- Keep existing hiragana as-is in the hiragana list
- Use standard Hepburn romanization for the romaji list
- Preserve particles and grammatical elements exactly
- Each comma in the input corresponds to exactly one comma in each output list

**Format:**
Input: "<comma-separated Japanese text>"
Output: "<hiragana-list>||<romaji-list>"

**Example:**
Input: "夏,の,ある,日,私,は,一人,で,家,の,前,の,浜,に,居た"

Output: "なつ,の,ある,ひ,わたし,は,ひとり,で,いえ,の,まえ,の,はま,に,いた||natsu,no,aru,hi,watashi,wa,hitori,de,ie,no,mae,no,hama,ni,ita"
"""

    res: GenerateResponse = generate(
        model="huihui_ai/qwen3-vl-abliterated:8b-instruct",
        prompt=f"Process the following input:\n\n{text}",
        system=SYSTEM
    )

    print(f"Transcribed List: {res.response}")
    try:
        hiragana_csv, romanji_csv = res.response.split("||")
        hiragana_list = hiragana_csv.split(",")
        romanji_list = romanji_csv.split(",")
        return hiragana_list, romanji_list
    except:
        print("Failed to parse transcribed response.")
        return None