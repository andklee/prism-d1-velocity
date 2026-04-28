# PRISM D1 Velocity — Leadership Presentation Script

> **Duration:** 12-15 minutes
> **Audience:** SA managers, leader of leaders, sales managers + their leaders
> **Setting:** Territory/district leadership meeting
> **Presenter notes:** [in brackets]. Speak conversationally, not reading slides.

---

## OPENING (2 minutes)

Hey team — at the start of the year, Aurelien and I put a thesis on the table during territory and district planning:

**"Land with developer tools. Expand on consumption."**

The idea was straightforward. Get Claude Code and Kiro adopted across customer engineering teams. Drive development-based token revenue from our district. Prove the playbook. Then scale it across districts using partners and forward deployment teams.

We made this a checklist item for every account team — check in with your customers on their AI development lifecycle journey. Where are they on tool adoption? What's their maturity?

[Pause]

Here's what we found.

---

## THE PROBLEM (2 minutes)

Three things were happening at every customer we talked to.

**One — developers were everywhere and nowhere.**

They were vibing. Copilot on one team. Claude Code on another. Cursor over here. ChatGPT copy-paste over there. No standards, no specs, no quality gates. Code was getting shipped faster — but it was getting shipped *blind*. Low quality, no traceability, no way to know if AI was helping or hurting.

**Two — engineering leaders were skeptical.**

CTOs and VPEs kept telling us the same thing: *"My team says AI makes them faster. I have no data to prove it. I can't take 'trust me' to the board."* They wanted metrics. Concrete, defensible metrics that connect AI adoption to business outcomes.

**Three — CISOs were blocking production use.**

Security leaders wouldn't sign off on AI-generated code in production. They wouldn't approve agents with access to internal tools. The questions were always: *"What guardrails exist? Who audits what the AI does? Where does our data go?"*

[Pause — let this land]

So we had a classic gap: developers adopting bottom-up with no controls, leaders wanting top-down visibility with no data, and security blocking the whole thing because nobody could answer the compliance questions.

---

## WHAT WE BUILT (4 minutes)

We built PRISM — Progressive Readiness Index for Scalable Maturity. Specifically, the D1 Velocity pillar.

It does three things:

### 1. Teach them to use AI the right way

We created a **4-hour workshop** with hands-on exercises that takes teams from ad-hoc AI use to a structured AI development lifecycle:

- **Spec-driven development** — every feature starts with a spec before AI writes a line of code. No more "vibe coding."
- **Eval gates in CI/CD** — Bedrock evaluates every AI-generated file against rubrics before it can merge. Security rubric. Code quality rubric. API contract rubric. The AI's work gets graded by AI before a human ever sees it.
- **Agent development done right** — Strands SDK for building agents, MCP for tool integration, AgentCore for production hosting. With scope-based authorization so agents can only access the tools they're allowed to touch.

And we give them a **bootstrapper** — git hooks, CI workflows, eval harnesses, agent configs — that they inherit on day one. They walk out of the workshop with instrumented repos.

### 2. Instrument everything, automatically

Here's where it gets interesting for our sales motion.

Every AI-assisted action — every commit, every PR, every eval gate, every agent invocation, every guardrail trigger — emits a structured event to **EventBridge**. A Lambda processor writes it to **DynamoDB** and publishes it to **CloudWatch**. All AWS-native. No third-party observability vendor. No per-seat licensing fees.

We track things no one else in the market tracks:
- **Token consumption per developer, per model, per commit** — via CloudTrail
- **Cost per commit** — correlated to actual Bedrock spend
- **Guardrail trigger rates** — content blocked, PII anonymized, denied topics enforced
- **MCP tool call audit trail** — which agents called which tools, with what authorization
- **AI vs human defect rates** — side-by-side comparison after deployment

[Pause]

### 3. Give visibility to both audiences

This is the payoff.

**For executives** — a dashboard that answers: *Are we getting faster? Is AI code reliable? What does it cost? Are we secure?*

DORA metrics with AI-native extensions. Eval gate pass rates. Guardrail compliance posture. Weekly Bedrock cost with budget tracking. AI vs human defect rate comparison. All in one pane of glass.

**For developers** — a real-time operational dashboard with hourly metrics. Pass rate by rubric so they know which eval gates they're failing. Token efficiency so they can optimize their prompting. Cost per commit so they see the economics of their AI usage.

Top-down visibility for leaders to make informed decisions. Bottom-up activation for developers to improve their craft.

---

## THE FLYWHEEL (2 minutes)

Here's why this matters for our business.

[Draw or show this on screen]

```
Customer adopts Claude Code / Kiro / Q Developer
         |
         v
PRISM instruments every AI action
         |
         v
Dashboard shows ROI, quality, cost
         |
         v
Leaders see proof it works
         |
         v
Leaders expand to more teams
         |
         v
More teams = more Bedrock inference
More eval gates = more Bedrock calls (judge model)
More agents = more Bedrock calls (multi-step reasoning)
More guardrails = more Bedrock calls (content checking)
         |
         v
The observability layer IS the consumption engine
```

Every feature in this platform generates more Bedrock API calls. The measurement layer doesn't just track usage — it *drives* usage.

A single feature going through spec, code, eval, and deploy can generate **10 to 20 Bedrock API calls**. Multiply that by 8 teams, 64 engineers, hundreds of features a quarter — and the token revenue compounds.

And here's the lock-in that matters: **no third-party tool can see CloudTrail data, deploy Bedrock Guardrails, or run Bedrock Evaluations as quality gates.** This is only possible on AWS.

---

## THE COMPETITIVE MOAT (1 minute)

Someone's going to ask: "Don't Jellyfish and Swarmia already do this?"

No. They measure *activity*. We measure **AI quality, safety, and cost.**

| What We Do | What They Don't |
|---|---|
| Eval gate pass rates (AI code graded before merge) | No quality gates |
| Guardrail enforcement + audit trail | No safety enforcement |
| Token-level cost attribution per developer | No Bedrock cost visibility |
| MCP tool authorization + scope governance | No agent governance |
| AI vs human defect rate comparison | No attribution by code origin |
| PRISM L1-L5 maturity model with progression path | Metrics only, no maturity journey |

Jellyfish charges $50K+ per year in per-seat licensing. PRISM runs on services customers already pay for.

---

## THE ASK (2 minutes)

Here's what I need from this room.

**For SA managers:**

This is ready to deploy. We have the workshop, the bootstrapper, the infrastructure, the dashboards, and the assessment toolkit. Any SA can run the PRISM assessment with a customer in 30 minutes and tell them their maturity level, what track they belong on, and what their first 4-hour workshop looks like.

I need you to make this a **standard qualification question** in every AI-DLC conversation: *"Have you assessed your PRISM level?"*

**For sales leaders:**

This is a land-and-expand accelerator. The workshop lands Claude Code and Kiro adoption. The metrics pipeline expands Bedrock consumption. The dashboards give leaders the data they need to double down.

When a CTO can see — in their own CloudWatch dashboard — that AI code has a 33% lower defect rate than human code, and it costs $0.42 per commit, they don't need convincing to expand to the next 5 teams. They need a purchase order.

**For partner and scale leaders:**

The bootstrapper is designed to be partner-deliverable. A trained partner can run the 4-hour workshop, deploy the CDK stack, and hand the customer a running metrics platform. We've documented every module, every exercise, every rubric. The leader guide has facilitator notes, timing, and checkpoint scripts.

---

## CLOSE (30 seconds)

We set out to prove that landing with developer tools and expanding on consumption works. PRISM is the proof.

It turns every AI-assisted line of code into a measurable business outcome — for the customer and for us.

The framework is live. The dashboards are running. The playbook is documented.

Let's take this to every customer in the district.

---

## APPENDIX: ANTICIPATED QUESTIONS

**Q: How long does deployment take?**
A: CDK stack deploys in under 10 minutes. Workshop is 4 hours. Customer has instrumented repos and live dashboards by end of day one.

**Q: What's the customer cost?**
A: Zero incremental licensing. Runs on CloudWatch, DynamoDB, EventBridge, and Lambda they already have. Bedrock inference cost is the product — typically $3-5K/month for a 5-team org.

**Q: What maturity level do most customers start at?**
A: L1 to L1.5. Ad-hoc AI use, no metrics. The workshop takes them to L2. The platform takes them to L3 within a quarter.

**Q: Can partners deliver this?**
A: Yes. Every module has solutions, checkpoints, and facilitator guides. We've designed it for partner scale from day one.

**Q: What if the customer already has Jellyfish/Swarmia?**
A: PRISM complements — it adds the AI-native layer (eval gates, guardrails, cost attribution, agent governance) that no 3P tool provides. The standard DORA features ensure a single pane of glass so the AI metrics get seen alongside the metrics they already trust.

**Q: How do we track success for our district?**
A: Number of PRISM assessments run, number of workshops delivered, Bedrock consumption growth in assessed accounts, PRISM level progression (L1 → L2 → L3) per customer.
