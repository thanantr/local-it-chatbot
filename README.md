# IT-NEXUS // Local IT LLM Tutor & Chatbot

IT-NEXUS is a local web application designed to help non-IT beginners master information technology. Featuring a structured **Learning Journey** roadmap, it pairs you with an LLM-powered IT Teacher/Tutor that teaches in plain English using simple, relatable analogies, testing your progress with micro-quizzes.

It also supports RAG (Retrieval-Augmented Generation), allowing you to upload local PDF, MD, or TXT documentation to chat with.

---

## 🛠️ Prerequisites

To run this application completely locally and offline, you need:

1. **Python 3.10+** (Python 3.14 is verified working).
2. **Ollama** installed on your system.
   - Download Ollama from [ollama.com](https://ollama.com).
   - Once installed, make sure it is running in your taskbar (default port `11434`).

### 🧠 Pulling Recommended Models

To teach IT concepts, write scripts, and parse documents, we recommend downloading these models:

```bash
# 1. Pull the LLM Model (Qwen 2.5 7B is highly recommended for coding and IT)
ollama pull qwen2.5:7b

# 2. Pull the Embedding Model (optional, used for indexing uploaded documents)
ollama pull nomic-embed-text
```

*Note: You can pull smaller models like `llama3` or `qwen2.5:1.5b` if you have limited RAM/VRAM.*

---

## 🚀 Getting Started

### 1. Install Python Dependencies
Open your terminal (PowerShell/Command Prompt) in the project directory:

```bash
pip install -r requirements.txt
```

### 2. Run the Backend Server
Start the FastAPI server:

```bash
python -m uvicorn backend.app:app --reload --port 8000
```

### 3. Open the Dashboard
Open your web browser and navigate to:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## 📖 How to Use the IT Tutor

### 🛣️ The Learning Journey Roadmap
1. In the left sidebar, you will see the **Learning Roadmap** divided into 4 core modules:
   - **Command Line & OS Basics**
   - **Computer Networking**
   - **Version Control & APIs**
   - **Containers & Cloud**
2. Expand a module and click on a sub-topic (e.g., *IP Addresses & DNS*).
3. The chatbot will automatically initiate a lesson, explaining the concepts with easy real-world analogies.
4. Read the explanation and **answer the micro-quiz** at the end of the lesson.
5. Once you answer correctly, you can click the checkbox next to the topic in the sidebar to mark it as **Mastered**. The overall progress bar will update and persist!

### 📚 Document Library (RAG)
If you have a specific system administration guide, class syllabus, or IT manual:
1. Expand the **Upload Reference Docs** section in the sidebar.
2. Select an embedding model from the **Engine Models** (e.g., `nomic-embed-text`) if pulled, or leave it blank to use the built-in keyword matcher.
3. Drag & drop or click to upload your text or PDF file.
4. Toggle **Enhance with Document Library (RAG)** above the chat input box.
5. Ask your question. The chatbot will retrieve the relevant passages from your uploaded document and answer using them.
