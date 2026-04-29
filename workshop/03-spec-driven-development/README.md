# Module 02: Spec-Driven Development

| | |
|---|---|
| **Duration** | 45 minutes |
| **Prerequisites** | Module 01 complete (Claude Code configured with CLAUDE.md) |
| **Learning Objective** | Write Kiro-compatible specs and use Claude Code to implement against them |

---

## Instructor Facilitation Guide

### [0-5 min] Why Specs Before Prompts

> **Instructor Note:** This is the conceptual anchor for the whole module. The temptation for engineers is to jump straight to "just tell Claude what to build." You need to make the case that the 5 minutes spent writing a spec saves 30 minutes of prompt-iterate-revert cycles.

**Key talking points:**

1. **"Spec quality before spec automation"** -- this is a core PRISM principle. If you can't write a clear spec that a human could implement, an LLM won't produce better results. The spec forces you to think before you prompt.

2. **The prompt-only failure mode:**
   - Developer tells Claude Code: "Add user auth"
   - Claude produces JWT auth with bcrypt, 400 lines
   - Developer wanted OAuth with Cognito
   - Now they're debugging AI-generated code they don't understand
   - Net time: slower than writing it by hand

3. **The spec-first success mode:**
   - Developer writes a spec: OAuth via Cognito, these 3 endpoints, these error cases
   - Claude Code implements exactly that
   - Developer reviews against acceptance criteria -- pass/fail is clear
   - Iteration is targeted: "The token refresh doesn't match AC #3, fix it"

4. **Specs are reusable artifacts.** They live in your repo. New team members read them. Your PM can review them. Your eval gates (Module 04) test against them. A prompt in a chat window is throwaway; a spec is infrastructure.

---

### [5-15 min] The Kiro Spec Format

Walk through the spec structure on the projector:

```markdown
# Feature: [Name]

## Requirements
Numbered list of what the feature must do. Each requirement is
independently testable.

## Acceptance Criteria
Given/When/Then format. These become your test cases and your
eval rubric (Module 04).

## Design Constraints
Technical boundaries: which services to use, performance targets,
security requirements, compatibility constraints.

## API Contract (if applicable)
Method, path, request/response schemas. This becomes your OpenAPI
fragment and your contract test.
```

> **Instructor Note:** Open Kiro and show the spec authoring experience. Kiro provides syntax highlighting, validation, and autocomplete for the spec format. Participants can use Kiro or a plain text editor -- the format is just markdown with conventions.

**Why this format works with Claude Code:**
- Requirements give Claude the scope boundary
- Acceptance criteria give Claude testable success conditions
- Design constraints prevent Claude from making architectural decisions you didn't authorize
- API contracts give Claude the exact interface to implement

---

### [15-30 min] Hands-On: Write and Implement a Spec

#### Exercise 1: Write a Spec (10 min)

Direct participants to `exercises/01-write-auth-spec.md`.

They'll write a spec for a user authentication endpoint. Provide the scenario:
- The sample app needs a `POST /auth/login` endpoint
- It should validate credentials against a user store
- Return a JWT token on success
- Handle error cases explicitly

> **Instructor Note:** Resist the urge to give them the complete spec. The learning is in the writing. Let them struggle with what to include in acceptance criteria vs. design constraints. After 7 minutes, show the reference spec from solutions/ for comparison.

#### Exercise 2: Implement the Spec with Claude Code (10 min)

Direct participants to `exercises/02-implement-spec.md`.

They'll:
1. Feed the spec to Claude Code
2. Time how long implementation takes (this is the spec-to-code turnaround metric)
3. Validate implementation against acceptance criteria

> **Instructor Note:** Have participants call out their implementation times. Collect a range on the whiteboard. Typical: 2-5 minutes for a well-written spec, 10-15 minutes for a vague one. This makes the case for spec quality better than any slide.

#### Exercise 3: Iterate When the Spec Has Gaps (5 min)

Direct participants to `exercises/03-spec-iteration.md`.

They'll:
1. Find a gap in their original spec (Claude Code's implementation reveals it)
2. Update the spec
3. Re-run Claude Code to implement the fix

---

### [30-40 min] The Spec-Implementation Loop

Draw the loop on the whiteboard:

```
     +-----------+
     |  Write    |
     |  Spec     |<---------+
     +-----+-----+          |
           |                 |
           v                 |
     +-----------+          |
     | Claude    |    Spec gaps
     | Code      |    revealed
     | Implement |          |
     +-----+-----+          |
           |                 |
           v                 |
     +-----------+          |
     | Validate  |----------+
     | vs. ACs   |
     +-----------+
           |
           | All ACs pass
           v
     +-----------+
     |  Commit   |
     |  (with    |
     |  trailers)|
     +-----------+
```

**Key metrics that emerge from this loop:**
- **Spec-to-Code Turnaround Time:** Time from spec completion to passing implementation
- **Spec Iteration Count:** How many loops before all ACs pass (lower = better spec)
- **AI First-Pass Acceptance Rate:** What % of acceptance criteria pass on the first Claude Code run

These become dashboard metrics in Module 05.

---

### Spec-Driven Eval Gates

Specs don't just guide implementation — they power automated quality gates.

**Spec-Compliance Eval Rubric:**

When a commit includes a `Spec-Ref:` trailer (e.g., `Spec-Ref: specs/user-search.md`), the PRISM eval gate runs an additional `spec-compliance` rubric that evaluates:

| Criterion | Weight | What It Checks |
|---|---|---|
| Requirement coverage | 0.35 | All acceptance criteria from the spec are implemented |
| Interface adherence | 0.25 | Function signatures and API contracts match the spec |
| Edge case handling | 0.20 | Edge cases described in the spec are handled |
| Spec intent fidelity | 0.20 | Implementation captures the spirit, not just the letter |

The eval runner supports a `--spec` flag to pass the spec file alongside the code:

```bash
./eval-harness/run-eval.sh rubrics/spec-compliance.json src/handler.ts --spec specs/user-search.md
```

**AI-DLC Workflow Integration:**

The PRISM bootstrapper includes AI-DLC steering files (adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows)) that enforce a structured inception → construction → quality gate workflow. When using Claude Code or Kiro, the steering files guide the agent through:

1. **Inception** — workspace detection, requirements analysis, spec creation
2. **Construction** — design, code generation, build & test
3. **Quality Gate** — eval gate runs automatically on PR

**Session Continuity:**

The AI-DLC workflow tracks session state in `.prism/session-state.json`. When a developer returns to continue work across sessions, the agent can resume from where it left off — including which spec is being implemented, what decisions were made, and which files were modified.

---

### [40-45 min] Wrap-Up

**Check for understanding:**
- "What goes wrong when you skip the spec and go straight to prompting?"
- "Which section of the spec does Claude Code rely on most?" (Answer: Acceptance criteria -- they define done)
- "How does spec iteration count tell you about spec quality?"

**Bridge to Module 03:** You've now written specs and implemented them. Every commit has AI origin metadata. But that metadata is sitting in git doing nothing. Next module, we wire it into a real metrics pipeline.

---

## Common Questions

**Q: Is this overkill for a simple bug fix?**
A: For a one-line typo fix, yes. The general rule: if you can describe the change in one sentence AND verify it with one test, skip the spec. If either condition fails, write one. Over time, teams calibrate their own threshold.

**Q: Can Claude Code write the spec for me?**
A: It can draft one, and that's a valid workflow -- especially for well-understood patterns. But someone with domain knowledge must review and approve the spec before implementation. AI-generated specs that go straight to AI implementation is a garbage-in-garbage-out loop.

**Q: How do Kiro specs differ from Jira tickets?**
A: Jira tickets describe what the business wants. Kiro specs describe what the code must do, in enough detail that an LLM (or a new engineer) can implement it without asking questions. A Jira ticket says "Users need to log in." A spec says "POST /auth/login accepts {email, password}, validates against Cognito user pool X, returns {token, expiresIn} with 200, returns 401 with Problem Details on bad credentials."
