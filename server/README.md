# Overview of llm service

the backend will require the ollama server and chromadb server to start before using.

## How to run

1. Chroma: for store and search embeddings. It can also apply metadata filtes to reuslt

```bash
# start the chroma server running on localhost:8000.
chroma run --path ./chroma_db --port 8000

#shut down server if ctrl+c not working
pkill -f chroma

```
    
2. ollama: Used for embedding and llm response


```bash
# start the ollama server running on localhost:11434.
ollama serve

```

3. run server.js


```bash`
cd server/
node server.js


# test
curl http://localhost:3000/api/ragAdvice/1
curl http://localhost:3000/api/fullLLM/1

```

### logic
### 2.1 user data services
### 2.2 rag services

Business logic
- Ingest: Read advice documents from `DATA_PATH` (see `src/config/rag_config.js`). For each document, compute an embedding using Ollama (`OLLAMA_EMBEDDING_MODEL`) and upsert into the Chroma collection (`CHROMA_COLLECTION`) with useful metadata (e.g., category, difficulty, tags).
- Retrieve: For a user query + context (goal, pace, HR, injury flags), embed the query, run a similarity search (top‑k) in Chroma, and return documents with distances and metadata.
- Filter & re‑rank: Apply metadata filters (e.g., `{difficulty: "beginner"}`) and optionally re‑rank results using domain scores (e.g., penalize advice that conflicts with user constraints).
- Orchestration: `rag/index.js` wires together embedding (`rag/embedding.js`) and vector store operations (`rag/engine.js`) behind simple functions such as ingest and search.

Key modules
- `src/config/rag_config.js`: Centralized configuration (host, collection, embedding model, data path).
- `src/services/rag/embedding.js`: Embedding helpers (batch/single text → float vector[] via Ollama).
- `src/services/rag/engine.js`: Chroma collection lifecycle (getOrCreate, add/upsert, query, delete/reset).
- `src/services/rag/index.js`: High‑level ingest/search entry points used by the server.
- `src/services/rag/rag.js`: Optional RAG orchestration glue that prepares retrieval inputs for the LLM.


### 2.3 llm services

Business logic
- Prompt building: Combine user telemetry (goal, HR, cadence, sleep), constraints (injury flags), and retrieved passages into a concise coaching prompt. Include system directives to keep responses short, actionable, and safe.
- Generation: Call Ollama chat model (e.g., `llama3`, `mistral`) to produce guidance. Optionally stream tokens for better UX.
- Post‑processing: Enforce length, simplify wording, and attach any citations or metadata from retrieval. Log usage for traceability.
- Interfaces: `llm_client.js` abstracts Ollama REST (`/api/chat` or `/api/generate`). `user_data.js` fetches user context from DB to enrich prompts.
