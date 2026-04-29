# Module 05: Eval Gates in CI/CD

| | |
|---|---|
| **Duration** | 45 minutes |
| **Prerequisites** | Module 03 complete (git hooks installed, metrics workflow configured) |
| **Learning Objective** | Add Bedrock Evaluation gates to CI/CD that block bad AI-generated code |

---

## Instructor Facilitation Guide

### [0-10 min] What Are Bedrock Evaluations and Why They Matter

> **Instructor Note:** This module is where skeptics become believers. The idea of using an LLM to evaluate another LLM's output sounds circular until you see it catch a real hallucination. Make sure the Exercise 3 demo lands -- it's the "aha" moment.

**Key talking points:**

1. **The AI-generated code quality problem:** Claude Code is good, but it's not perfect. It can:
   - Hallucinate API endpoints that don't exist in your codebase
   - Generate code that compiles but doesn't match the spec's intent
   - Introduce subtle logic errors that pass unit tests but fail in production
   - Use deprecated library methods

2. **Traditional testing catches some of this.** Type checking, unit tests, and integration tests are necessary but not sufficient. They test what you thought to test. They don't catch "this code does something coherent but wrong."

3. **Bedrock Evaluations add a semantic quality layer.** You define rubrics (evaluation criteria), and a judge model (Claude Haiku for speed) evaluates the generated code against those rubrics. It's like a code review by an AI that's specifically looking for the failure modes you care about.

4. **The LLM-as-Judge pattern:**
   ```
   Input:     The spec + the generated code
   Judge:     Claude Haiku (fast, cheap)
   Rubric:    "Does the implementation match the spec's acceptance criteria?"
              "Does the code call only APIs that exist in the codebase?"
              "Are all error cases from the spec handled?"
   Output:    Score (0-1) per rubric + rationale
   Gate:      If any score < threshold, fail the pipeline
   ```

5. **Why Haiku as judge, not Sonnet/Opus?**
   - Speed: Haiku evaluates in 1-3 seconds per rubric
   - Cost: 10-50x cheaper than Opus
   - Accuracy: For rubric-based evaluation, Haiku is nearly as accurate as larger models
   - Separation: You don't want the same model evaluating its own output (though different model versions work fine, a smaller/different model adds real diversity)

---

### [10-15 min] Eval Rubric Deep-Dive

Show a rubric on the projector:

```json
{
  "rubric_name": "api_spec_compliance",
  "description": "Evaluates whether generated API code matches its spec",
  "criteria": [
    {
      "name": "acceptance_criteria_coverage",
      "description": "Does the implementation address every acceptance criterion in the spec?",
      "scoring": "For each AC in the spec, check if the code implements it. Score = (implemented ACs) / (total ACs)",
      "threshold": 1.0,
      "weight": 0.4
    },
    {
      "name": "api_contract_match",
      "description": "Do the actual request/response schemas match the spec's API contract?",
      "scoring": "Compare endpoint path, method, request body fields, response body fields, and status codes. Score 1.0 for exact match, 0.5 for partial, 0.0 for mismatch.",
      "threshold": 0.8,
      "weight": 0.3
    },
    {
      "name": "error_handling_completeness",
      "description": "Are all error cases from the spec handled with correct status codes?",
      "scoring": "For each error case in the spec, check if the code returns the correct status code and response format. Score = (correct errors) / (total error cases)",
      "threshold": 0.8,
      "weight": 0.2
    },
    {
      "name": "no_hallucinated_apis",
      "description": "Does the code only call functions/modules that exist in the codebase?",
      "scoring": "Check all import statements and function calls. Score 1.0 if all resolve to real modules, 0.0 if any import or call targets a non-existent module.",
      "threshold": 1.0,
      "weight": 0.1
    }
  ]
}
```

Walk through each criterion:
- **acceptance_criteria_coverage** -- The most important check. Threshold is 1.0 (all ACs must be covered). Weight is highest.
- **api_contract_match** -- Catches schema drift. Threshold is 0.8 (allows minor differences like extra response fields).
- **error_handling_completeness** -- Catches the "happy path only" failure mode. Threshold is 0.8.
- **no_hallucinated_apis** -- Binary check. Either all imports are real or they're not.

---

### [15-25 min] Exercise 1: Create an Eval Rubric

Direct participants to `exercises/01-create-rubric.md`.

They will:
1. Create an eval rubric for the sample-app's API responses
2. Define at least 4 criteria with thresholds
3. Understand how the rubric gets consumed by the eval gate

---

### [25-35 min] Exercise 2: Add the Eval Gate to CI

Direct participants to `exercises/02-eval-gate-workflow.md`.

They will:
1. Create a GitHub Actions workflow step that runs the eval
2. Wire it to the Bedrock InvokeModel API with the rubric
3. Configure pass/fail thresholds

---

### [35-42 min] Exercise 3: Catch a Hallucination

Direct participants to `exercises/03-catch-hallucination.md`.

> **Instructor Note:** This is the crowd-pleaser. Have everyone do this together, step by step, and show the eval gate output on the projector. When they see the gate flag a non-existent API call that would have passed unit tests, it clicks.

They will:
1. Deliberately introduce a hallucinated API call into the codebase
2. Run the eval gate locally
3. Watch it fail with a clear rationale

---

---

### Smart Rubric Routing

The eval gate workflow automatically selects the best rubric based on the file being evaluated:

| File Pattern | Rubric | Focus |
|---|---|---|
| `agent`, `assistant`, `orchestrat`, `workflow`, `chain` | `agent-quality.json` | Step count, tool correctness, agent loop quality |
| `auth`, `security`, `guard`, `policy`, `iam`, `crypto` | `security-compliance.json` | OWASP, encryption, input validation, least privilege |
| `api`, `handler`, `route`, `controller` | `api-response-quality.json` | Contract adherence, status codes, error format |
| Everything else | `code-quality.json` | Correctness, readability, testing, performance |

**Spec-Compliance Pass:**

If a commit has a `Spec-Ref:` trailer pointing to a spec file, the eval gate runs an additional `spec-compliance` rubric that checks:
- Requirement coverage (35% weight) — are all acceptance criteria implemented?
- Interface adherence (25%) — do signatures match the spec?
- Edge case handling (20%) — are spec-defined edge cases covered?
- Spec intent fidelity (20%) — does the code capture the spirit of the spec?

Use the `--spec` flag for local testing:

```bash
./eval-harness/run-eval.sh rubrics/spec-compliance.json src/handler.ts --spec specs/user-search.md
```

**All 5 Rubrics:**

| Rubric | Criteria | Pass Threshold |
|---|---|---|
| `code-quality.json` | 7 criteria (correctness, readability, maintainability, error handling, testing, performance, docs) | 0.82 |
| `api-response-quality.json` | 6 criteria (contract, status codes, validation, pagination, errors, idempotency) | 0.82 |
| `agent-quality.json` | 5 criteria (reasoning, tool selection, error recovery, efficiency, output quality) | 0.82 |
| `security-compliance.json` | 10 criteria (auth, injection, secrets, data protection, IAM, errors, HTTP headers, logging, dependencies, **Security Agent findings**) | 0.82 |
| `spec-compliance.json` | 4 criteria (requirement coverage, interface adherence, edge cases, intent fidelity) | 0.82 |

**Per-Rubric Metrics:**

Every eval emits a `prism.d1.eval` event with the rubric name, enabling the Team Velocity dashboard to show pass rates broken down by rubric type. This helps teams see which categories of AI code need the most improvement.

**AWS Security Agent Integration (SECURITY-09):**

The `security-compliance` rubric includes a 10th criterion: `security_agent_findings`. When AWS Security Agent is configured, the eval gate queries for open Critical/High findings on the repo. Open CRITICAL findings force the criterion score to 1/5, typically failing the 0.82 pass threshold and blocking merge.

Security Agent operates across the AI-DLC lifecycle:
- **Design Review** — analyzes specs for architectural security risks before coding begins
- **Code Review** — scans PRs against organizational security policies
- **Pen Testing** — validates deployed applications against OWASP Top 10

Findings feed back into the AI-DLC workflow: teams revise specs, design, and code based on findings. The `FindingSurvivalRate` metric tracks whether teams catch issues earlier over time.

---

---

### [42-45 min] Extension: Security Agent Code Review (+10 min)

> **Instructor Note:** This extension shows how Security Agent code review complements eval gates. Requires Security Agent access or use screenshots. See the [Security Agent Setup Guide](../../bootstrapper/security-agent/SETUP-GUIDE.md) for console configuration steps.

**Context for participants:** The eval gate checks code quality via Bedrock. Security Agent checks for actual vulnerabilities — injection paths, auth bypasses, secret exposure. They work together.

**They will:**
1. Open a PR with AI-generated code (from Exercise 2)
2. See two checks running in parallel:
   - PRISM eval gate (Bedrock rubric scoring)
   - Security Agent code review (vulnerability scanning)
3. Review Security Agent findings alongside eval gate scores
4. See how SECURITY-09 blocks merge when Critical/High findings are open

**Demo walkthrough:**

```
PR #42: Add user authentication endpoint

PRISM Eval Gate:          PASS (0.88 / 0.82 threshold)
  code-quality:           0.92 ✓
  security-compliance:    0.84 ✓  ← would fail if open CRITICAL findings
  spec-compliance:        0.91 ✓

Security Agent Code Review:
  MEDIUM: Input validation missing on email parameter (CWE-20)
  LOW: Verbose error message includes stack trace (CWE-209)
  
Result: PASS (no CRITICAL/HIGH findings)
```

Now show what happens with a critical finding:

```
Security Agent Code Review:
  CRITICAL: SQL injection via unsanitized user input (CWE-89)
  
PRISM Eval Gate:          FAIL
  security-compliance:    0.20 ✗  ← SECURITY-09 forced to 1/5
  
Result: MERGE BLOCKED
```

**Key insight:**

> "The eval gate is a quality score. Security Agent is a vulnerability scanner. The eval gate tells you 'this code is well-written.' Security Agent tells you 'this code is safe.' You need both. And when Security Agent finds a Critical issue, it automatically fails the eval gate via SECURITY-09 — no human intervention needed."

**The feedback loop:**
- Developer fixes the SQL injection
- Pushes a new commit
- Security Agent re-scans, finding resolved
- Eval gate re-runs, SECURITY-09 passes
- `prism.d1.security.remediation` event emitted with remediation time
- Dashboard shows: "Critical finding fixed in 2.3 hours by AI-assisted code"

---

### [42-45 min] Wrap-Up

**Check for understanding:**
- "What's the difference between a unit test and an eval gate?"
- "Why use Haiku as the judge instead of the same model that wrote the code?"
- "What threshold would you set for your production pipeline?"
- "Which rubric would evaluate a new IAM policy Lambda?" (Answer: security-compliance)
- "What happens if Security Agent finds a CRITICAL vulnerability in your PR?" (Answer: SECURITY-09 forces eval gate to fail, merge blocked)

**Bridge to Module 06:** You now have metrics flowing (Module 04) and quality gates enforcing standards (Module 05). In Module 06, we connect it all to dashboards so the team and leadership can see the full picture.

---

## Common Questions

**Q: Isn't this just testing? Why not write better tests?**
A: Tests verify specific behaviors you anticipated. Eval gates verify semantic properties ("does this match the intent?") that are hard to express as traditional assertions. They're complementary, not replacements.

**Q: How much does running evals cost?**
A: With Haiku as judge: roughly $0.001-$0.01 per evaluation (depending on input size). For a typical PR with 5 files, you're looking at $0.01-$0.05 per PR. At 50 PRs/week, that's $2.50/week.

**Q: What if the eval gate produces false positives?**
A: Start with loose thresholds (0.6) and tighten over time as you calibrate. Log all eval results (including rationales) so you can audit false positives and refine rubrics. The rubric is a living document, just like your test suite.

**Q: Can we run evals on human-written code too?**
A: Absolutely. The eval gate doesn't check AI-Origin -- it evaluates all code against the rubric. This is actually a best practice: it catches spec drift regardless of who wrote the code.
