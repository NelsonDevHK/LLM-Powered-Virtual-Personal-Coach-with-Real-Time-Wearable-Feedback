# Phase 3 Architecture (LAN-Only)

## Overview
This document defines a LAN-only implementation plan for watchOS, backend, and report integration.

Project assumptions:
1. This project does not need public internet deployment.
2. Local same-Wi-Fi testing is acceptable.
3. Each user pairs once with one watch for this project.

Execution order:
1. Phase 1: Integrate watch app with backend first using simulator data.
2. Phase 2: Validate on a real watch over same Wi-Fi.
3. Phase 3: Fix and stabilize report after network flow is proven.
4. Phase 4: Implement minimal one-time pairing per user-watch.

---

## Core Question: How Does Server Know Which User Sent Watch Data?

Short answer: the server identifies user by JWT in the Authorization header.

Yes, the intended flow is:
1. User logs in as one account.
2. That account is paired once with one watch.
3. Watch stores that account token (or watch token issued during pairing).
4. Every watch request sends that token.
5. Backend middleware verifies token and gets user_id.
6. Controllers/services use that user_id for feedback and DB writes.

---

## JWT Identity Flow (Visual)

### Pair Once

```text
Frontend Login (user_name + password)
  -> Backend issues JWT containing user_id

User starts one-time pair
  -> Backend binds user_id <-> device_uuid
  -> Backend returns watch-usable JWT

Watch stores JWT locally
```

### Runtime Calls

```text
Watch sends request
  Authorization: Bearer <jwt>

authenticateJWT middleware
  -> verify signature / expiry
  -> req.user = { user_id, user_name, ... }

watch.controller
  -> const userId = req.user.user_id
  -> call service with userId

watch.service
  -> generate feedback or save wearable_data with user_id
```

### Failure Cases

```text
No Bearer header      -> 401 Missing or invalid Authorization header
Invalid/expired token -> 401 Invalid or expired token
Valid token           -> continue
```

---

## Phase 1 (Focus): Simulator Integration First

Objective: prove watch -> backend -> response/save loop works before pairing complexity.

### Scope
1. Use current endpoints only: POST /api/watch/in-session-feedback and POST /api/watch/session-end.
2. Use manual dev JWT in watch app for this phase only.
3. Trigger cadence: call in-session feedback on each Start Rest tap, and call session-end once on End Workout.

### Payload Mapping (Current Watch Reality)
1. heart_rate: from HealthKit live value.
2. exercise_type: from watch UI selected type.
3. set_count: from watch UI counter.
4. rest_duration: from phase timer.
5. current_speed: fallback value when not available.
6. sleep_duration: null/default.
7. sleep_quality: null/default.

### Success Criteria
1. In simulator, Start Rest returns 200 and suggestion text.
2. In simulator, End Workout returns 201 and dataId.
3. DB has expected wearable_data row for JWT user_id.

---

## Phase 2: Real Watch Validation on Same Wi-Fi

Objective: prove physical watch can reach local backend reliably.

### Scope
1. Configure watch app base URL to backend LAN IP, not localhost.
2. Ensure Mac and phone/watch are on same Wi-Fi.
3. Repeat same flow as simulator.

### Success Criteria
1. Real watch receives in-session feedback.
2. Real watch session-end writes to DB successfully.
3. Server logs show authenticated user_id for requests.

---

## Phase 3: Report Stabilization

Objective: make report consistent with authenticated identity and watch-origin data.

### Scope
1. Remove hardcoded user assumptions in report data fetch.
2. Ensure wearable fetch is user-authorized (self data only).
3. Verify session summary path stays authenticated.
4. Verify rendering stability with watch-origin rows.

### Success Criteria
1. Logged-in user sees only own wearable data.
2. No report runtime errors after watch data ingestion.
3. LLM summary action remains authorized.

---

## Phase 4: Minimal One-Time Pairing (Final)

Objective: replace manual dev JWT with clean one-time pairing workflow.

### Minimal Rules for This Project
1. One active watch per user.
2. Pair once and reuse token across sessions.
3. If watch resets or changes, re-pair and replace old mapping.

### Suggested Minimal Pairing Endpoints
1. POST /api/watch/pair-init
2. POST /api/watch/pair-confirm

Optional later:
1. POST /api/watch/pair-revoke

### Success Criteria
1. User pairs once successfully.
2. Watch can call protected watch endpoints without manual token copy.
3. Backend consistently maps requests to correct user_id.

---

## Security Position for LAN Scope

Accepted for this project stage:
1. LAN-only traffic during development/demo.
2. Minimal JWT lifecycle complexity.
3. Basic token validation via existing middleware.

Deferred until needed:
1. Public internet hardening.
2. Advanced refresh-token architecture.
3. Production certificate pinning and complex revocation policies.

---

## Quick Checklists

### Phase 1 Checklist (Today)
1. Watch request builder sends Authorization Bearer header.
2. Start Rest triggers in-session endpoint.
3. End Workout triggers session-end endpoint once.
4. Confirm 200/201 results and DB insert.

### Phase 2 Checklist
1. Real watch uses LAN IP URL.
2. Same test flow passes on physical device.

### Phase 3 Checklist
1. Report uses authenticated identity path.
2. Report render and summary remain stable.

### Phase 4 Checklist
1. One-time pair flow implemented.
2. User-watch mapping stored and reusable.

---

## Open Decisions (For Later Discussion)
1. Token expiry policy for watch token in LAN usage.
2. Whether to support multiple watches per user in future.
3. Whether to add idempotency key for duplicate session-end prevention.

---

## Phase 4: LLM/RAG Refactor Plan (Keep Current Behavior)

Objective:
1. Keep current ask/watch behavior that works today.
2. Remove overlapping logic across route and service layers.
3. Make `llm.service.js#getResponse` the canonical ask path.
4. Keep watch feedback path independent.

### Why This Is Needed
1. `/api/ask` currently inlines grouped data fetch, conversation history, RAG fetch, and LLM input assembly.
2. `llm.service.js#getResponse` exists but follows an older prompt/data flow.
3. RAG is active, but orchestration is duplicated across files.
4. Prompt builder/templates are partially used (RAG path yes, coach path mostly legacy).

### Current Behavior Snapshot
1. Ask path (`/api/ask`):
2. Uses grouped user data + conversation history + RAG advice.
3. Calls `getLLMResponse` directly in `app.js`.
4. Persists user and assistant messages.

5. Watch in-session path (`/api/watch/in-session-feedback`):
6. Uses watch-specific prompt and controls (dedup, cache, fallback, anti-repetition).
7. Pulls recent wearable sessions + in-session HR history context.
8. Calls `getLLMResponse` via watch service.

9. Legacy fullLLM path (`/api/llm/fullLLM/:userId`):
10. Uses `llm.service.js#getResponse` with older builder/template flow.

### Refactor Scope (Sectioned Tasks)

#### Section A: Prompt Layer Consolidation
1. Add/refresh ask-specific prompt builder path under `src/services/prompts/builder.js`.
2. Stop assembling ask prompt inline in `src/app.js`.
3. Keep watch prompt generation in `src/services/watch.service.js` unchanged.

#### Section B: Template Integration Cleanup
1. Keep a clear ask coaching template owner in `src/services/prompts/templates.js`.
2. Keep a clear RAG intent template owner (if RagPromptBuilder uses it).
3. Remove unused template imports/constants after migration.

#### Section C: Canonical Ask Service
1. Refresh `src/services/llm.service.js#getResponse` to accept ask inputs (`userId`, `question`, `messages`).
2. Move ask context assembly into service helpers:
3. grouped profile/wearable,
4. conversation history,
5. RAG advice retrieval,
6. prompt build,
7. model invocation.
8. Preserve ask output contract at route boundary (`{ result }`).

#### Section D: Route and Legacy Wiring
1. Make `src/app.js` `/api/ask` a thin wrapper over `llmService.getResponse(...)`.
2. Keep auth and rate-limit semantics unchanged.
3. Align `/api/llm/fullLLM/:userId` route/controller to refreshed `getResponse` behavior.

#### Section E: RAG Observability (Prompt Tuning)
1. Add structured ask-level RAG logs (count, preview, joined chars).
2. Add rag service query start/end logs with counts.
3. Add engine-level Chroma query confirmation logs.
4. Use these logs to verify:
5. Chroma is actually queried,
6. `ragAdviceArr` is non-empty when expected,
7. final `ragAdvice` quality for prompt tuning.

#### Section F: Watch Compatibility Guardrails
1. Preserve watch controls: dedup, pending-reuse, fallback, similarity guard.
2. Preserve watch context usage: last 5 workouts + last 10 in-session HR.
3. Do not enforce ask template constraints onto watch output.

#### Section G: Regression Checklist
1. `/api/ask` supports both `question` and `messages` modes.
2. `/api/ask` still saves user + assistant chat messages.
3. `/api/ask` still includes RAG context.
4. `/api/watch/in-session-feedback` output schema unchanged.
5. No nested RAG deadlock (`useGate:false` when required).

### Non-Goals in This Refactor
1. No change to watch pairing architecture.
2. No change to report authorization model.
3. No change to external API response schemas.

---

## Phase 3.5: Implementation Status

### Section A: Prompt Layer Consolidation ✅ IN PROGRESS

**Completed:**
1. ✅ Created `AskPromptBuilder` class in `src/services/prompts/builder.js`
   - Takes grouped user data, conversation history, and RAG advice
   - Builds comprehensive fitness coaching prompt with wearable context
   - Uses fitness-focused COACH_TEMPLATE with placeholders: {age}, {fitness_level}, {heart_rate}, {context}, {history}
   - Prepends wearable context summary (last workout metrics)
   - Formats conversation history with Q/A pairs

2. ✅ Rewrote `RagPromptBuilder` to focus on fitness (not running-specific)
   - Changed instructions to cover multiple fitness domains: cardiovascular, strength, flexibility, recovery, nutrition, sleep
   - Removed running-specific language ("runner", "running pace")
   - Simplifies prompt to core user profile + wearable context

3. ✅ Updated templates in `src/services/prompts/templates.js` - Fitness-Focused
   - **COACH_TEMPLATE:** Now emphasizes comprehensive fitness coaching
     - Covers multiple activity types (not just running)
     - Includes cardiovascular, strength, flexibility, recovery, nutrition, sleep
     - Non-diagnostic guidance ("listen to your body, consult professional if concerned")
     - Users: {age}, {fitness_level}, {heart_rate}, {context}, {history} placeholders
   
   - **RAG_TEMPLATE:** Updated for fitness knowledge retrieval
     - Covers all fitness dimensions, not running-specific
     - Used by RagPromptBuilder for semantic search queries

4. ✅ Updated `LlmPromptBuilder` to use new fitness-focused template fields
   - Changed field names: fitness_level (was excercise_level)
   - Preserved backward compatibility in field extraction

**Remaining in Section A:**
- Next: Section D will refactor `src/app.js` `/api/ask` route to use `AskPromptBuilder`
- Then: Test that ask responses are better with fitness-focused prompts vs. running-only

**Note:** The RagPromptBuilder and AskPromptBuilder are ready; app.js still uses inline prompt assembly.
This will be wired in Section D (Route Wiring).

### Section B: Template Integration Cleanup ✅ COMPLETED (Corrected)

**Completed:**
1. ✅ Extracted inline RAG prompt to RAG_TEMPLATE in templates.js
   - RagPromptBuilder now uses RAG_TEMPLATE instead of building prompt inline
   - Template has placeholders: {gender}, {age_group}, {exercise_level}, {wearable_summary}
   
2. ✅ Clarified template ownership in templates.js
   - **RAG_TEMPLATE**: Canonical RAG query template, used by RagPromptBuilder
   - **COACH_TEMPLATE**: Canonical fitness coaching template
     - Used by: AskPromptBuilder (ask endpoint) + LlmPromptBuilder (legacy fullLLM)
     - Covers all fitness dimensions

3. ✅ Eliminated inline template building
   - RagPromptBuilder now uses RAG_TEMPLATE with .replace() placeholders
   - All template logic centralized in templates.js
   - Builders only handle context extraction and template filling

**Current Template Status:**
- ✅ RAG_TEMPLATE: Canonical RAG query template, used by RagPromptBuilder, fitness-focused
- ✅ COACH_TEMPLATE: Canonical fitness coaching template, used by AskPromptBuilder & LlmPromptBuilder
- ✅ RagPromptBuilder: Uses RAG_TEMPLATE (template-based, not inline)
- ✅ AskPromptBuilder: Uses COACH_TEMPLATE
- ✅ LlmPromptBuilder: Uses COACH_TEMPLATE (legacy route)

### Execution Order Recommendation
1. Implement ask service refresh first.
2. Rewire ask route second.
3. Add RAG observability third.
4. Clean dead code/imports last.

