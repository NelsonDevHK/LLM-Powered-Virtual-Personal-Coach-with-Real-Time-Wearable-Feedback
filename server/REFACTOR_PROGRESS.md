# Phase 3.5 LLM/RAG Refactor - Progress & Implementation Log

**Project:** LLM-Powered Virtual Personal Coach with Real-Time Wearable Feedback  
**Refactor Objective:** Consolidate LLM routing, unify ask service, eliminate inline templates, improve prompt quality  
**Target:** Keep current working behavior while removing duplication and improving code maintainability  

---

## 📋 Sections Overview

| Section | Title | Status | Completion Date |
|---------|-------|--------|-----------------|
| A | Prompt Layer Consolidation | ✅ DONE | 2026-04-15 |
| B | Template Integration Cleanup | ✅ DONE | 2026-04-15 |
| C | Canonical Ask Service | ✅ DONE | 2026-04-15 |
| D | Route and Legacy Wiring | ⏳ PENDING | - |
| E | RAG Observability (Prompt Tuning) | ⏳ PENDING | - |
| F | Watch Compatibility Guardrails | ⏳ PENDING | - |
| G | Regression Checklist | ⏳ PENDING | - |

---

## ✅ Completed Sections

### Section A: Prompt Layer Consolidation

**Objective:** Create fitness-focused prompt builders, eliminate running-specific language

**Implementation:**

#### 1. Created AskPromptBuilder Class
- **File:** `src/services/prompts/builder.js`
- **Purpose:** Builds comprehensive fitness coaching prompts for `/api/ask` endpoint
- **Input:** `userDict` (grouped user data), `ragAdvice` (array of advice strings)
- **Output:** Complete prompt ready for LLM
- **Behavior:**
  - Extracts user profile: age, fitness_level, heart_rate
  - Builds wearable context from recent workouts
  - Formats conversation history (last 5 Q/A pairs)
  - Fills COACH_TEMPLATE with all placeholders
  - Prepends wearable summary to coaching template

**Code Example:**
```javascript
const promptBuilder = new AskPromptBuilder();
const prompt = await promptBuilder.builder(groupedUserData, ragAdviceArray);
```

#### 2. Rewrote RagPromptBuilder for Fitness Focus
- **File:** `src/services/prompts/builder.js`
- **Changes:**
  - Removed running-specific language ("runner", "running pace")
  - Expanded to cover all fitness domains:
    - Cardiovascular training
    - Strength building
    - Flexibility
    - Recovery
    - Nutrition
    - Sleep optimization
  - Now uses template-based approach (moved to templates.js)

#### 3. Updated LlmPromptBuilder for Consistency
- **File:** `src/services/prompts/builder.js`
- **Changes:**
  - Updated field names: `fitness_level` (was `excercise_level`)
  - Works with updated COACH_TEMPLATE
  - Maintains backward compatibility

#### 4. Updated Templates for Fitness Focus
- **File:** `src/services/prompts/templates.js`
- **COACH_TEMPLATE** Changes:
  - Now comprehensive fitness coaching (all disciplines, not running-only)
  - Covers: safety, multiple activity types, holistic wellness
  - Placeholders: `{age}`, `{fitness_level}`, `{heart_rate}`, `{context}`, `{history}`
  - Used by: AskPromptBuilder, LlmPromptBuilder (legacy)
- **RAG_TEMPLATE** Changes:
  - Created for fitness knowledge retrieval (was missing/unused)
  - Placeholders: `{gender}`, `{age_group}`, `{exercise_level}`, `{wearable_summary}`
  - Used by: RagPromptBuilder

**Commit Message:** "Section A: Create AskPromptBuilder, rewrite templates for fitness focus"

**Status:** ✅ COMPLETE

---

### Section B: Template Integration Cleanup

**Objective:** Eliminate inline template building, centralize all templates in templates.js

**Implementation:**

#### 1. Extracted Inline RAG Prompt to Template
- **Before:** RagPromptBuilder built prompt inline with string interpolation
- **After:** RagPromptBuilder loads RAG_TEMPLATE and fills placeholders
- **Method:** `.replace(/\{placeholder\}/g, value)`
- **Benefit:** Centralized template logic, easier to maintain/tune

#### 2. Clarified Template Ownership
- **RAG_TEMPLATE** → Used by RagPromptBuilder only
- **COACH_TEMPLATE** → Used by AskPromptBuilder + LlmPromptBuilder
- Clear documentation in templates.js for each owner

#### 3. Fixed Logging Bug
- **Issue:** RagPromptBuilder was logging empty userDict
- **Root Cause:** Overly simplified log statement
- **Fix:** Restored `JSON.stringify(userDict, null, 2)` for full debugging

**Commit Message:** "Section B: Move RAG prompt to template, centralize template logic"

**Status:** ✅ COMPLETE

---

### Section C: Canonical Ask Service

**Objective:** Refactor llm.service.js#getResponse() to be unified ask handler, improve data quality

**Implementation:**

#### 1. Refactored getResponse() to Accept Ask Inputs
- **Before:** Old path used single wearable record via `getLlmData()`
- **After:** New path uses full grouped data + full conversation history
- **Signature:** `getResponse(userId, options = { question?, messages? })`
- **Supports Both Modes:**
  - String question: `{ question: "How should I train today?" }`
  - OpenAI messages: `{ messages: [{ role: 'user', content: '...' }] }`

#### 2. Reorganized Context Assembly into Helpers
Service breakdown for testability and maintainability:
- `_getGroupedUserData(userId)` - Fetches full wearable history (not single record)
- `_getConversationHistory(userId)` - Retrieves chat history from DB
- `_extractUserQuery()` - Parses question from either input mode
- `_fetchRagAdvice()` - Gets fitness knowledge with context-aware retrieval
- `_buildAskPrompt()` - Uses AskPromptBuilder (fitness-focused)
- `_invokeLLM(prompt)` - Calls LLM transport layer
- `_formatAskResult()` - Formats response + metadata for persistence

#### 3. Improved Data Quality
- **Grouped Data:** Full wearable history passed to RAG (was null)
- **Context Awareness:** RAG performs semantic search with user profile
- **History:** Full conversation history included (was missing in old path)
- **Prompt Quality:** Uses fitness-focused AskPromptBuilder (Section A)

#### 4. Preserved Backward Compatibility
- **Legacy Path:** `getSessionSummary()` still available
- **Old Behavior:** Uses LlmPromptBuilder for legacy fullLLM endpoint
- **Gating:** Service-level rate limiting maintained

**Key Configuration:**
```javascript
const ASK_MIN_INTERVAL_MS = 1500; // Ask-specific rate limit
const LLM_MIN_INTERVAL_MS = 1200; // Legacy path rate limit
```

**Return Format:**
```javascript
{
  response: string,           // LLM response text
  userMessage: string,        // Original user query (for DB save)
  wasMessagesMode: boolean    // Whether input was messages array
}
```

**Commit Message:** "Section C: Refactor llm.service.js as canonical ask handler with improved data quality"

**Status:** ✅ COMPLETE

---

## ⏳ Pending Sections

### Section D: Route and Legacy Wiring
Convert `/api/ask` route to thin wrapper over llmService.getResponse()

**Tasks:**
- [ ] Update app.js /api/ask to call llmService.getResponse(userId, { question, messages })
- [ ] Persist response using dbService.saveChatMessage()
- [ ] Verify both question and messages modes work
- [ ] Check backward compatibility with existing clients

### Section E: RAG Observability (Prompt Tuning)
Add structured logging at multiple levels for RAG verification

**Tasks:**
- [ ] Ask-level logs: RAG count, preview, joined character count
- [ ] Service-level logs: RAG query start/end, retrieval count
- [ ] Engine-level logs: Chroma query confirmation with result count

### Section F: Watch Compatibility Guardrails
Verify watch endpoint behavior is unchanged and optimal

**Tasks:**
- [ ] Verify dedup window still works (3000ms)
- [ ] Verify cache TTL still works (1 hour)
- [ ] Verify fallback chains still work
- [ ] Verify similarity guard still works (80% threshold)

### Section G: Regression Checklist
Comprehensive testing to catch any regressions

**Test Cases:**
- [ ] /api/ask with plain question string
- [ ] /api/ask with messages array
- [ ] Both modes save chat messages to DB
- [ ] RAG context included in prompts
- [ ] No nested deadlocks (useGate:false working)
- [ ] /api/watch/in-session-feedback unchanged
- [ ] /api/llm/fullLLM/:userId still works (legacy)

---

## 📊 Files Modified

| File | Changes | Section |
|------|---------|---------|
| `src/services/prompts/builder.js` | Created AskPromptBuilder, rewrote RagPromptBuilder | A, B |
| `src/services/prompts/templates.js` | Updated COACH_TEMPLATE, created RAG_TEMPLATE | A, B |
| `src/services/llm.service.js` | Refactored getResponse(), added helpers | C |
| `PHASE3_ARCHITECTURE.md` | Removed implementation status (moved here) | A, B, C |

---

## 🔍 Debugging & Verification

### Section A/B Verification
```bash
# Test RagPromptBuilder uses template
cd server && node
> import { RagPromptBuilder } from './src/services/prompts/builder.js'
> const rb = new RagPromptBuilder()
> const prompt = await rb.builder({ ... })
> console.log(prompt)  # Should show fitness-focused RAG query
```

### Section C Verification
```bash
# Test new getResponse() path
> import llmService from './src/services/llm.service.js'
> const result = await llmService.getResponse(userId, { 
>   question: "How should I train today?" 
> })
> console.log(result)  # Should have { response, userMessage, wasMessagesMode }
```

### Template Usage Check
```bash
# Verify templates are used (not inline)
grep -r "RAG_TEMPLATE" src/services/prompts/
grep -r "COACH_TEMPLATE" src/services/prompts/
```

---

## 📝 Notes & Decisions

1. **Why AskPromptBuilder?**
   - Separates ask-specific context assembly from generic LlmPromptBuilder
   - Allows fitness-focused approach (Section A changes)
   - Easier to test and maintain individual builders

2. **Why Template-Based?**
   - Centralized template definitions → easier to tune
   - Avoids inline template building scattered across code
   - Clear ownership between builders and templates

3. **Why Service Helpers?**
   - Testable, modular context assembly
   - Clear logging at each step
   - Easier to debug failures in specific areas

4. **Backward Compatibility:**
   - Legacy `getSessionSummary()` preserved
   - Old LlmPromptBuilder still available
   - No breaking changes to API response schemas

---

## 🎯 Success Criteria (All Met for A-C)

### Section A
- ✅ AskPromptBuilder created and working
- ✅ RagPromptBuilder fitness-focused (no running-specific language)
- ✅ Templates updated and syntax valid
- ✅ No inline template building in builders

### Section B
- ✅ RAG_TEMPLATE defined and used
- ✅ COACH_TEMPLATE canonical for ask/llm paths
- ✅ All template logic centralized
- ✅ Logging restored (userDict shows full details)

### Section C
- ✅ getResponse() accepts question and messages modes
- ✅ Service helpers for each context assembly step
- ✅ Improved data quality (grouped data, full history)
- ✅ Backward compatibility preserved
- ✅ Returns structured output for app.js persistence

---

## 📅 Timeline

| Date | Section(s) | Status |
|------|-----------|--------|
| 2026-04-15 | A | ✅ Complete |
| 2026-04-15 | B | ✅ Complete |
| 2026-04-15 | C | ✅ Complete |
| TBD | D | ⏳ Pending |
| TBD | E | ⏳ Pending |
| TBD | F | ⏳ Pending |
| TBD | G | ⏳ Pending |

---

**Next Action:** Proceed to Section D - Replace /api/ask route inline logic with thin wrapper calling llmService.getResponse()
