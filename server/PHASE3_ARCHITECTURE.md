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

