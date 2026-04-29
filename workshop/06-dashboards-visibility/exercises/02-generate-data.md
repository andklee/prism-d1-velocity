# Exercise 2: Generate Sample Metric Data

**Time:** 5 minutes

## Objective

Generate a week's worth of realistic metric data across the full AI-DLC lifecycle, send it to EventBridge, and watch all three dashboards populate.

## Prerequisites

- CDK stack deployed (`npx cdk deploy --all` from Exercise 1)
- AWS credentials configured
- `jq` and `bc` installed

## Steps

### Step 1: Run the data generator

```bash
cd workshop/06-dashboards-visibility/exercises/
chmod +x generate-sample-data.sh
./generate-sample-data.sh
```

The script generates **7 days** of simulated team activity (~500+ events):

| Category | What Gets Generated |
|---|---|
| **Commits** | 5 engineers, 2 repos, mix of human/AI-assisted/AI-generated |
| **PR merges** | 2-4 per day with lead time trending down |
| **Deploys** | One per merged PR with deployment frequency |
| **Eval gates** | Per-rubric scores for all 5 rubrics (code-quality, API, security, agent, spec) |
| **Guardrail triggers** | Content filters, PII anonymization, denied topics — BLOCK and ANONYMIZE actions |
| **MCP tool calls** | 20-60 per day across 5 tools, 2% denied rate |
| **Token usage** | Bedrock API calls with Sonnet/Haiku pricing per developer |
| **Cost per commit** | Token-to-commit correlation with cost USD |
| **Agent invocations** | 5-20 per day with steps, tools, tokens, success/failure |
| **Quality (defects)** | AI vs human defect rates per daily deploy |
| **Security Agent findings** | 1-4 per day across design review, code review, pen test |
| **Security remediation** | ~33% of findings get fixed with timing + AI/human attribution |
| **One "bad day"** | Day 4 has a spike in eval failures (can you find it?) |

### Step 2: How it flows

```
generate-sample-data.sh
  → aws events put-events (EventBridge bus: prism-d1-metrics)
    → metrics-processor Lambda (auto-triggered by EventBridge rules)
      → DynamoDB events table (stored, 365-day TTL)
      → DynamoDB metadata table (latest snapshot per team)
      → CloudWatch metrics (PRISM/D1/Velocity namespace)
        → Dashboard widgets update automatically
        → Alarms evaluate within minutes
```

**Data retention:**
- CloudWatch metrics: 15 months
- DynamoDB events: 365 days (auto-expired via TTL)

### Step 3: Check all three dashboards

Open CloudWatch → Dashboards. Set time range to **"Last 1 week"** for each:

#### Team Velocity (`PRISM-D1-Team-Velocity`)

| Section | What You Should See |
|---|---|
| DORA & AI-DORA | Acceptance rate ~68%, deploy freq 3-5/day, lead time trending down |
| Agent Operations | 5-20 invocations/day, ~94% success rate |
| Eval Gate by Rubric | Pass rates per rubric (security-compliance lowest, code-quality highest) |
| Guardrails & Safety | PII anonymization (emails/phones), content filter blocks, denied topics |
| MCP Governance | Tool call volume growing, occasional denied calls |
| Cost Intelligence | Daily token usage (Sonnet vs Haiku), cost per commit ~$0.30-0.50 |
| AI Attribution | AI defect rate lower than human, spec-to-code trending down |
| Security Agent | Findings by severity, AI vs human origin, phase breakdown |

#### Executive Readout (`PRISM-D1-Executive-Readout`)

| Section | What You Should See |
|---|---|
| DORA Summary | 5 KPI cards with week-over-week trends |
| AI Contribution | 3-line trend: acceptance rate, merge ratio, test coverage |
| Security & Compliance | Guardrail blocks, MCP denied, exfiltration alerts (0) |
| Cost Intelligence | Weekly Bedrock cost bar chart, cost per deploy |

#### CISO Compliance (`PRISM-D1-CISO-Compliance`)

| Section | What You Should See |
|---|---|
| Security Posture | Critical findings count, exploit count, remediation time |
| AI Code Risk Profile | Findings by code origin (AI vs human), remediation time comparison |
| Shift-Left | Findings by phase (design → code → pen test), guardrail trends |

### Step 4: Identify the patterns

Look at the dashboards and answer:

1. **Which day had the eval gate dip?** (Hint: Day 4 — a new engineer used Claude Code without a spec)

2. **Which rubric fails most often?** (Hint: check the "Pass Rate by Rubric" widget)

3. **Is AI code safer than human code?** (Hint: compare the dual-line chart in AI Attribution)

4. **How fast are security findings getting fixed?** (Hint: check remediation time in the CISO dashboard)

5. **Are guardrails blocking or anonymizing more?** (Hint: PII is anonymized, content is blocked — different actions for different categories)

### Step 5: Explore the alarms

Check CloudWatch → Alarms. You should see **12 alarms**, all in OK state with the sample data:

| Alarm | Status | Why OK |
|---|---|---|
| AI Acceptance Rate Low | OK | 68% > 20% threshold |
| Eval Gate Pass Rate Low | OK | ~87% > 70% threshold |
| Change Failure Rate High | OK | ~7% < 20% threshold |
| Agent Success Rate Low | OK | ~94% > 80% threshold |
| Guardrail Block Rate High | OK | ~5/day << 50/hour threshold |
| Bedrock Daily Cost High | OK | ~$68/day < $100 threshold |
| Token Efficiency Low | OK | ~187 tokens/line < 500 threshold |
| Exfiltration Alert | OK | 0 alerts |
| Security Critical Finding | OK | No CRITICAL findings in sample data |
| Pen Test Exploit Detected | OK | Rare exploits in sample data |
| Security Remediation SLA | OK | Avg ~18h < 72h threshold |
| Security Finding Rate High | OK | ~3/day << 50/6h threshold |

## Verification

You've completed this exercise when:
- [ ] Data generator ran successfully (~500+ events emitted)
- [ ] Team Velocity dashboard shows all 8 sections populated
- [ ] Executive Readout shows DORA summary + security + cost sections
- [ ] CISO Compliance dashboard shows security posture + AI risk profile
- [ ] All 12 alarms are in OK state
- [ ] You can identify the "bad day" in the eval gate data
- [ ] You understand what each widget's info tooltip (i) describes
