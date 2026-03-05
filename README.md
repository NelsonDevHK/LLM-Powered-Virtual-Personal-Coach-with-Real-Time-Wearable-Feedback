# LLM-Powered-Virtual-Personal-Coach-with-Real-Time-Wearable-Feedback


# Overview
LLM-Powered Virtual Personal Coach with real-time, text-based fitness coaching using wearable data. The coach reminds users about workout intensity based on heart rate and past training history.

Real-time Training: Live LLM chat coaching during workouts, adjusting intensity reminders from heart rate zones and previous sessions.

Report: Post‑workout summary with metrics (time in zone, pace, HR trends) plus LLM insights like “Your warm‑up was too short, try adding 5 minutes next time.”

Leaderboard: Social layer where friends compare activity via weekly points, time in target zone, and consistency instead of just raw steps.

Tech Stack / Project Structure
Frontend: React.js SPA (web).

Backend: Node.js REST API server.

LLM Model: ollama.

## LLM & RAG components

The backend isn’t just a vanilla REST API – it’s an LLM‑powered coach.
Two pieces make that possible:

* **Ollama** – a locally‑running large language model (phi4‑mini by
    default).  The `src/services/llm_client.js` code sends user messages
    to Ollama and returns the generated assistant reply.  Having the
    model on‑premises avoids external API costs and keeps data private.

* **Chroma (RAG engine)** – a vector database (`chromadb` package)
    that stores embeddings of the fitness advice documents under
    `data/fitness_advice.json`.  When a user asks a question, the
    `rag` utilities embed the query, fetch the most relevant passages
    from Chroma, and prepend them to the prompt sent to the model.
    This retrieval‑augmented‑generation step ensures the coach’s
    responses are grounded in the training material and can cite
    specific guidance (“your warm‑up was too short…”), rather than
    relying solely on the unlocked model weights.

Together, these components let the frontend simply call `POST
/api/ask` with a message and receive a context‑aware coaching reply.

### Running the LLM & RAG services

Before using `/api/ask` you must have both the model and the Chroma
server running.  In development this usually means:

#### without Docker (preferred)

```bash
# start a local Ollama model (requires `ollama` CLI)
ollama pull phi4-mini           # download model once
ollama serve phi4-mini &        # listen on http://localhost:11434

# start Chroma directly from npm
cd server
npm install chromadb          # if not already installed
node - <<'JS'
import { run } from 'chromadb';
run();                         // launches server on port 8000
JS &
```

#### optional: using Docker

```bash
ollama pull phi4-mini
docker run -d --name fyp-chroma -p 8000:8000 \
    -v "$(pwd)/data:/home/chroma/data" \
    ghcr.io/chroma-core/chroma:latest
```

The backend’s `llm_client` and RAG helpers already point at these
endpoints; no additional configuration is required.

> **Note:** if you don’t run these services the `/api/ask` endpoint
> will still respond, but without RAG context the answers may be
> generic.

Wearable Devices Integration: To be decided (placeholder).

Database: mySQL.

## Database Testing

The backend uses a MySQL database (default name `fyp_coach`).
You can verify the schema and connectivity using the provided test
script or by running commands manually.

### Environment
Create a `.env` file under `server/` with at least:
```dotenv
DB_HOST=127.0.0.1
DB_USER=root
DB_PASSWORD=<your password>
DB_NAME=fyp_coach
DB_PORT=3306
```

### Automatic script
```bash
cd server
node scripts/test_db.mjs
```

This script prints:
1. connection details (host, port, database name, user)
2. health-check query result
3. list of tables and their column names
4. row counts for `users`, `wearable_data`,
   and `conversation_history`
5. example queries using repository helpers
6. foreign-key integrity checks

### Manual commands
You can also run individual commands from the shell:

```bash
# check database exists and list tables
mysql -u root -p -e "SHOW DATABASES LIKE 'fyp_coach'; USE fyp_coach; SHOW TABLES;"

# show schema for a table
mysql -u root -p -e "USE fyp_coach; SHOW COLUMNS FROM users;"

# count rows
mysql -u root -p -e "USE fyp_coach; SELECT COUNT(*) FROM users;"

# simple query through node connection (uses server/.env)
cd server
node -e "import 'dotenv/config'; const {db} = await import('./src/database/index.js'); await db.initialize(); console.log(await db.query('SELECT 1')); await db.close();"
```

Running the script or commands above will confirm that the
backend can reach the database, that the necessary tables exist,
and that the repository layer is functional.

## Running the Application

The repository includes both the backend API server and the frontend
React application.  Below are the commands used in development and a
simple production workflow.

### Development mode

```bash
# start the backend (reads server/.env)
cd server
node server.js

# open a second shell for the frontend
cd Client-App
npm install     # first time only
npm run dev     # Vite dev server (default port 5173)
```

Set `VITE_API_BASE` in the frontend environment if the API is
hosted elsewhere.

### Production build

1. Build the React app:

```bash
cd Client-App
npm install      # ensure deps
npm run build    # generates dist/ directory
```

2. Serve the static assets.  Either copy `dist/` to a web server
    (nginx, Apache, etc.) or extend the Express server to serve it:

```js
// in server.js, before starting the HTTP listener
app.use(express.static('../Client-App/dist'));
```

3. Start the backend in production mode:

```bash
cd server
NODE_ENV=production node server.js
```

The API will listen on `SERVER_PORT` (default 3000) and will no longer
watch or hot‑reload.

