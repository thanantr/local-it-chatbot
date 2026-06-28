import os
import json
import re
import math
import requests
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader

app = FastAPI(title="IT Tutor Chatbot Backend")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration & Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS_DIR = os.path.join(BASE_DIR, "documents")
VECTOR_STORE_PATH = os.path.join(BASE_DIR, "vector_store.json")
PROGRESS_DB_PATH = os.path.join(BASE_DIR, "progress.json")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

# Ensure folders exist
os.makedirs(DOCS_DIR, exist_ok=True)

# Default IT Learning Path Structure
DEFAULT_PROGRESS = {
    "overall_progress": 0,
    "modules": {
        "module1": {
            "name": "Command Line & OS Basics",
            "status": "Not Started",
            "score": 0,
            "topics": {
                "navigating_filesystems": {"name": "Filesystem Navigation", "status": "Not Started"},
                "basic_shell_commands": {"name": "Basic Linux/Windows Shell Commands", "status": "Not Started"},
                "shell_scripting": {"name": "Writing Simple Shell Scripts", "status": "Not Started"}
            }
        },
        "module2": {
            "name": "Computer Networking",
            "status": "Not Started",
            "score": 0,
            "topics": {
                "ip_and_dns": {"name": "IP Addresses & DNS", "status": "Not Started"},
                "routers_and_ports": {"name": "Routers, Firewalls & Ports", "status": "Not Started"},
                "http_protocol": {"name": "HTTP & Web Requests", "status": "Not Started"}
            }
        },
        "module3": {
            "name": "Version Control & APIs",
            "status": "Not Started",
            "score": 0,
            "topics": {
                "git_basics": {"name": "Git Basics (Clone, Commit, Push)", "status": "Not Started"},
                "rest_apis": {"name": "REST APIs Explained Simply", "status": "Not Started"},
                "json_data": {"name": "Reading & Writing JSON Data", "status": "Not Started"}
            }
        },
        "module4": {
            "name": "Containers & Cloud",
            "status": "Not Started",
            "score": 0,
            "topics": {
                "docker_basics": {"name": "Docker & Containers Basics", "status": "Not Started"},
                "cloud_hosting": {"name": "Cloud Hosting & Servers", "status": "Not Started"},
                "virtualization": {"name": "Virtualization vs. Containers", "status": "Not Started"}
            }
        }
    }
}

# --- Stopwords for Fallback Keyword Matcher ---
STOPWORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "aren't", "as", "at",
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "can't", "cannot", "could",
    "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for",
    "from", "further", "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll", "he's",
    "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's", "i", "i'd", "i'll", "i'm",
    "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its", "itself", "let's", "me", "more", "most", "mustn't",
    "my", "myself", "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours",
    "ourselves", "out", "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't",
    "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves", "then", "there",
    "there's", "these", "they", "they'd", "they'll", "they're", "they've", "this", "those", "through", "to", "too",
    "under", "until", "up", "very", "was", "wasn't", "we", "we'd", "we'll", "we're", "we've", "were", "weren't",
    "what", "what's", "when", "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why",
    "why's", "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your", "yours",
    "yourself", "yourselves"
}

# --- Database Helper Functions ---
def load_db() -> Dict[str, Any]:
    if not os.path.exists(VECTOR_STORE_PATH):
        return {"documents": {}, "chunks": []}
    try:
        with open(VECTOR_STORE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"documents": {}, "chunks": []}

def save_db(db: Dict[str, Any]):
    with open(VECTOR_STORE_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)

def load_progress() -> Dict[str, Any]:
    if not os.path.exists(PROGRESS_DB_PATH):
        # Write default progress to file
        save_progress(DEFAULT_PROGRESS)
        return DEFAULT_PROGRESS
    try:
        with open(PROGRESS_DB_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_PROGRESS

def save_progress(progress: Dict[str, Any]):
    with open(PROGRESS_DB_PATH, "w", encoding="utf-8") as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)

# --- Math & Search Helpers ---
def dot_product(v1: List[float], v2: List[float]) -> float:
    return sum(x * y for x, y in zip(v1, v2))

def magnitude(v: List[float]) -> float:
    return sum(x * x for x in v) ** 0.5

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    m1, m2 = magnitude(v1), magnitude(v2)
    if not m1 or not m2:
        return 0.0
    return dot_product(v1, v2) / (m1 * m2)

def tokenize(text: str) -> List[str]:
    return [w for w in re.findall(r'\b[a-zA-Z0-9_]+\b', text.lower()) if w not in STOPWORDS]

def keyword_similarity(query_tokens: List[str], text: str) -> float:
    if not query_tokens:
        return 0.0
    text_tokens = tokenize(text)
    if not text_tokens:
        return 0.0
    text_set = set(text_tokens)
    matches = sum(1 for token in query_tokens if token in text_set)
    return matches / len(query_tokens)

# --- Ollama API Connectors ---
def get_ollama_embedding(text: str, model: str) -> Optional[List[float]]:
    # Method 1: New /api/embed API
    try:
        r = requests.post(
            f"{OLLAMA_HOST}/api/embed",
            json={"model": model, "input": text},
            timeout=10
        )
        if r.status_code == 200:
            res = r.json()
            if "embeddings" in res and res["embeddings"]:
                return res["embeddings"][0]
    except Exception:
        pass

    # Method 2: Legacy /api/embeddings API
    try:
        r = requests.post(
            f"{OLLAMA_HOST}/api/embeddings",
            json={"model": model, "prompt": text},
            timeout=10
        )
        if r.status_code == 200:
            res = r.json()
            if "embedding" in res:
                return res["embedding"]
    except Exception:
        pass

    return None

# --- Text Chunking ---
def chunk_text(text: str, chunk_size: int = 800, overlap: int = 150) -> List[str]:
    chunks = []
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        if end < len(text):
            limit = max(start, end - 100)
            boundary = -1
            for i in range(end, limit, -1):
                if text[i-1] in ('.', '!', '?', '\n'):
                    boundary = i
                    break
            if boundary != -1:
                end = boundary
            else:
                boundary = text.rfind(' ', limit, end)
                if boundary != -1:
                    end = boundary
        
        chunks.append(text[start:end].strip())
        start = end - overlap
        if start >= len(text) or end == len(text):
            break
            
    return [c for c in chunks if len(c) > 10]

# --- API Endpoints ---

@app.get("/api/status")
def get_status():
    try:
        r = requests.get(OLLAMA_HOST, timeout=3)
        return {
            "status": "connected",
            "ollama_host": OLLAMA_HOST,
            "message": "Connected to Ollama successfully."
        }
    except Exception as e:
        return {
            "status": "disconnected",
            "ollama_host": OLLAMA_HOST,
            "message": f"Could not connect to Ollama: {str(e)}"
        }

@app.get("/api/models")
def get_models():
    try:
        r = requests.get(f"{OLLAMA_HOST}/api/tags", timeout=5)
        if r.status_code == 200:
            models = r.json().get("models", [])
            chat_models = []
            embedding_models = []
            
            for m in models:
                capabilities = m.get("capabilities", [])
                name_lower = m["name"].lower()
                
                # 1. Determine if it is an embedding model
                is_embedding = "embedding" in capabilities
                if not is_embedding and any(w in name_lower for w in ["embed", "bge", "minilm"]):
                    is_embedding = True
                    
                # 2. Determine if it is a chat/completion model
                is_chat = "completion" in capabilities or "chat" in capabilities
                # If capabilities not declared, default to chat if it's not clearly an embedding model
                if not is_chat and not is_embedding:
                    is_chat = True
                    
                if is_chat:
                    chat_models.append(m)
                if is_embedding:
                    embedding_models.append(m)
                    
            return {
                "chat_models": chat_models,
                "embedding_models": embedding_models
            }
        return {"chat_models": [], "embedding_models": [], "error": f"Ollama returned status {r.status_code}"}
    except Exception as e:
        return {"chat_models": [], "embedding_models": [], "error": str(e)}

# --- PROGRESS TRACKING API ---

@app.get("/api/progress")
def get_progress():
    return load_progress()

@app.post("/api/progress/update")
def update_progress(payload: Dict[str, Any]):
    module_id = payload.get("module_id")
    topic_id = payload.get("topic_id")
    status = payload.get("status") # "Not Started", "In Progress", "Mastered"
    
    if not module_id or not topic_id or not status:
        raise HTTPException(status_code=400, detail="Missing module_id, topic_id, or status")
        
    db = load_progress()
    if module_id not in db["modules"]:
        raise HTTPException(status_code=404, detail="Module not found")
        
    module = db["modules"][module_id]
    if topic_id not in module["topics"]:
        raise HTTPException(status_code=404, detail="Topic not found")
        
    # Update topic status
    module["topics"][topic_id]["status"] = status
    
    # Recalculate module status
    topic_statuses = [t["status"] for t in module["topics"].values()]
    if all(s == "Mastered" for s in topic_statuses):
        module["status"] = "Mastered"
    elif any(s in ("In Progress", "Mastered") for s in topic_statuses):
        module["status"] = "In Progress"
    else:
        module["status"] = "Not Started"
        
    # Recalculate module completion score (percentage)
    mastered_count = sum(1 for s in topic_statuses if s == "Mastered")
    module["score"] = int((mastered_count / len(topic_statuses)) * 100)
    
    # Recalculate overall progress (across all topics in the path)
    all_topics = []
    for m in db["modules"].values():
        for t in m["topics"].values():
            all_topics.append(t["status"])
            
    total_topics = len(all_topics)
    total_mastered = sum(1 for s in all_topics if s == "Mastered")
    db["overall_progress"] = int((total_mastered / total_topics) * 100) if total_topics else 0
    
    save_progress(db)
    return db

@app.post("/api/progress/reset")
def reset_progress():
    save_progress(DEFAULT_PROGRESS)
    return DEFAULT_PROGRESS

# --- DOCUMENT LIBRARY API ---

@app.get("/api/documents")
def get_documents():
    db = load_db()
    return {"documents": db.get("documents", {})}

@app.post("/api/clear-index")
def clear_index():
    db = {"documents": {}, "chunks": []}
    save_db(db)
    for filename in os.listdir(DOCS_DIR):
        file_path = os.path.join(DOCS_DIR, filename)
        if os.path.isfile(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
    return {"message": "Index and uploaded files cleared successfully."}

@app.post("/api/delete-document")
def delete_document(payload: Dict[str, str]):
    filename = payload.get("filename")
    if not filename:
        raise HTTPException(status_code=400, detail="Filename not specified")
    
    db = load_db()
    if filename in db["documents"]:
        del db["documents"][filename]
        db["chunks"] = [c for c in db["chunks"] if c["document"] != filename]
        save_db(db)
        
        file_path = os.path.join(DOCS_DIR, filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except Exception:
                pass
        return {"message": f"Document '{filename}' deleted."}
    else:
        raise HTTPException(status_code=404, detail="Document not found")

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...),
    embedding_model: Optional[str] = Form(None)
):
    filename = file.filename
    file_path = os.path.join(DOCS_DIR, filename)
    
    with open(file_path, "wb") as f:
        f.write(await file.read())
        
    text = ""
    try:
        if filename.endswith(".pdf"):
            reader = PdfReader(file_path)
            for page in reader.pages:
                text_page = page.extract_text()
                if text_page:
                    text += text_page + "\n"
        else:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read()
    except Exception as e:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Failed to parse file: {str(e)}")
        
    if not text.strip():
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail="No readable text found in file.")
        
    chunks = chunk_text(text)
    if not chunks:
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=400, detail="File is too short to chunk.")

    db = load_db()
    db["documents"][filename] = {
        "added_at": filename,
        "size_bytes": os.path.getsize(file_path),
        "chunks_count": len(chunks),
        "embedding_model": embedding_model if embedding_model else "None (Keyword Match Only)"
    }
    
    db["chunks"] = [c for c in db["chunks"] if c["document"] != filename]
    
    success_embeddings = 0
    for idx, chunk in enumerate(chunks):
        vector = None
        if embedding_model:
            vector = get_ollama_embedding(chunk, embedding_model)
            if vector:
                success_embeddings += 1
                
        db["chunks"].append({
            "document": filename,
            "chunk_idx": idx,
            "text": chunk,
            "embedding": vector
        })
        
    save_db(db)
    
    return {
        "message": f"Successfully indexed '{filename}' into {len(chunks)} chunks.",
        "chunks": len(chunks),
        "embeddings_generated": success_embeddings,
        "mode": "semantic" if success_embeddings > 0 else "keyword"
    }

# --- CHAT / PROXY ENDPOINT ---

TUTOR_SYSTEM_PROMPT = (
    "You are a patient, encouraging, and highly skilled IT Teacher and Tutor. "
    "Your student is a non-IT beginner, so you must explain all technical concepts using "
    "simple everyday analogies (e.g., comparing DNS to a phonebook, or Docker containers to shipping cargo containers). "
    "Do NOT use heavy IT jargon without explaining it in simple terms first. "
    "Keep your tone positive, encouraging, and friendly. "
    "Keep your explanations brief and step-by-step. "
    "Crucially: At the end of every response explaining a concept, write a short, 1-question quiz "
    "(multiple choice or a simple open-ended question) to test the student's understanding. "
    "Ask them to type their answer. If they answer correctly in their next turn, congratulate them "
    "and tell them they can mark this topic as complete. If they answer incorrectly, guide them gently to the correct answer."
)

@app.post("/api/chat")
async def chat_endpoint(payload: Dict[str, Any]):
    model = payload.get("model")
    messages = payload.get("messages", [])
    use_rag = payload.get("use_rag", False)
    embedding_model = payload.get("embedding_model")
    system_prompt = payload.get("system_prompt", TUTOR_SYSTEM_PROMPT)
    temperature = payload.get("temperature", 0.7)
    
    if not model:
        raise HTTPException(status_code=400, detail="LLM Model name must be specified.")
    if not messages:
        raise HTTPException(status_code=400, detail="Messages list cannot be empty.")
        
    user_query = messages[-1]["content"]
    retrieved_context = ""
    
    if use_rag:
        db = load_db()
        chunks = db.get("chunks", [])
        if chunks:
            scored_chunks = []
            query_vector = None
            
            if embedding_model:
                query_vector = get_ollama_embedding(user_query, embedding_model)
                
            query_tokens = tokenize(user_query)
            
            for chunk in chunks:
                score = 0.0
                if query_vector and chunk.get("embedding"):
                    score = cosine_similarity(query_vector, chunk["embedding"])
                else:
                    score = keyword_similarity(query_tokens, chunk["text"])
                
                scored_chunks.append((score, chunk))
                
            scored_chunks.sort(key=lambda x: x[0], reverse=True)
            top_chunks = [item[1] for item in scored_chunks[:4] if item[0] > 0.05]
            
            if top_chunks:
                context_parts = []
                for tc in top_chunks:
                    context_parts.append(f"Source: {tc['document']}\n---\n{tc['text']}\n---")
                retrieved_context = "\n\n".join(context_parts)
                
    final_system_prompt = system_prompt
    if retrieved_context:
        final_system_prompt += (
            f"\n\nContext information from uploaded documents is provided below. "
            f"Use this context to help teach the student. Do not read raw configs directly, "
            f"instead digest them and explain them using simple terms.\n\n"
            f"--- CONTEXT ---\n{retrieved_context}\n--- END CONTEXT ---"
        )
        
    ollama_messages = [{"role": "system", "content": final_system_prompt}]
    for msg in messages:
        ollama_messages.append({"role": msg["role"], "content": msg["content"]})
        
    ollama_payload = {
        "model": model,
        "messages": ollama_messages,
        "stream": True,
        "options": {
            "temperature": temperature
        }
    }
    
    def ollama_stream_generator():
        try:
            r = requests.post(
                f"{OLLAMA_HOST}/api/chat",
                json=ollama_payload,
                stream=True,
                timeout=120
            )
            if r.status_code != 200:
                yield f"data: {json.dumps({'error': f'Ollama returned status {r.status_code}'})}\n\n"
                return
                
            if retrieved_context:
                sources = list(set([tc['document'] for tc in top_chunks]))
                yield f"data: {json.dumps({'sources': sources})}\n\n"
                
            for line in r.iter_lines():
                if line:
                    decoded = line.decode('utf-8')
                    chunk_data = json.loads(decoded)
                    message_chunk = chunk_data.get("message", {}).get("content", "")
                    done = chunk_data.get("done", False)
                    
                    yield f"data: {json.dumps({'content': message_chunk, 'done': done})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            
    return StreamingResponse(ollama_stream_generator(), media_type="text/event-stream")

# Serve the static files
frontend_path = os.path.join(BASE_DIR, "frontend")
os.makedirs(frontend_path, exist_ok=True)
app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
