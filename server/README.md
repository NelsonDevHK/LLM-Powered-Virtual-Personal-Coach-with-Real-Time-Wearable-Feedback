# Overview of Backend service

the backend will require the ollama server and chromadb server to start before using.

## How to run

### ***Chroma***: for store and search embeddings. 

```bash
# start the chroma server running on localhost:8000.
chroma run --path ./chroma_db --port 8000

#shut down server if ctrl+c not working
pkill -f chroma

```
    
### ***ollama***: Used for embedding and llm response


```bash
# start the ollama server running on localhost:11434.
ollama serve

```

### ***Backend Server*** : orchestration for llm response

```bash

cd server/
node src/server.js

```



## test

```bash

curl http://localhost:3000/api/ragAdvice/{userId}

curl http://localhost:3000/api/fullLLM/1

```

## logic

### 2.1 user data services

- it will call the repository. *repositories* will directly react with DB

- user_data will gather the useful data from three tables and send the Dictionary for building prompts for llm and rag

### 2.2 rag services

- ***embeddding***: 

- ***engine***:

- query(arg, top_k):

### 2.3 llm services

- routes -> controller -> services -> llm_client

- llm.service will be the main flow. calling other services, ie prompt buildier, query data, calling rag

- will use /api/generate endpoint for the response. This is for real_time feedback only. 


## future improvement

1. the llm now only generate a real_time feedback We need a llm response for session summary
    1.1 new prompt needed
    1.2 need user_data for query data
    1.3 need to check the content of db, may need to change in furture

2. the real_time feedback will still store in db(coneversation_history), need to make a json for tempery storage
