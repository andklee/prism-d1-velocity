# Module 05: Dashboards & Visibility

| | |
|---|---|
| **Duration** | 30 minutes |
| **Prerequisites** | Modules 03-04 complete (metrics flowing, eval gates configured) |
| **Learning Objective** | Deploy and interpret the executive readout and team velocity dashboards |

---

## Instructor Facilitation Guide

### [0-5 min] The Two-Dashboard Strategy

> **Instructor Note:** This module is shorter because it's mostly deploy-and-observe. The conceptual framing matters though -- teams often build dashboards nobody looks at. Emphasize who looks at which dashboard and what decisions they make from it.

**Key talking points:**

1. **Two dashboards, two audiences:**

   | Dashboard | Audience | Cadence | Key Question |
   |-----------|----------|---------|-------------|
   | Team Velocity (CloudWatch) | Engineering team, tech lead | Daily / per-sprint | "Is AI helping us ship faster and better?" |
   | Executive Readout (QuickSight) | CTO, VP Eng, Board | Weekly / monthly | "What's the ROI of our AI tooling investment?" |

2. **Team dashboard (CloudWatch):**
   - Real-time, auto-refreshing
   - Shows the 6 AI-DORA metrics
   - Drill-down by engineer, repo, time range
   - Alerts on anomalies (acceptance rate drop, contribution ratio spike)
   - Engineers own it and iterate on it

3. **Executive dashboard (QuickSight):**
   - Curated, presentation-ready
   - Trends over weeks/months (not minutes)
   - Benchmarked against PRISM maturity levels
   - Shows cost efficiency (AI spend vs. velocity gain)
   - PM/CTO owns it, reviews weekly

4. **The data flow recap:**
   ```
   Git Trailers          (Module 01-03)
       |
   GitHub Actions        (Module 03)
       |
   EventBridge           (Module 03)
       |
   Timestream            (pre-deployed)
       |
   +---+---+
   |       |
   CW      QS
   Team    Exec
   ```

---

### [5-15 min] Exercise 1: Deploy the CloudWatch Team Dashboard

Direct participants to `exercises/01-deploy-dashboard.md`.

They will:
1. Deploy a CloudWatch dashboard using the provided CDK stack
2. Review the dashboard panels and understand what each shows
3. See their workshop commits appear as data points

> **Instructor Note:** The CDK stack creates the Timestream database, EventBridge rules, and CloudWatch dashboard in one deploy. If the workshop AWS account already has these resources, participants connect to the existing dashboard instead. Check beforehand.

---

### [15-22 min] Exercise 2: Generate Sample Data and Watch the Dashboard

Direct participants to `exercises/02-generate-data.md`.

They will:
1. Run the metric data generator to simulate a week of team activity
2. Watch the dashboard populate with realistic patterns
3. Identify trends (what does a healthy team look like vs. concerning patterns)

> **Instructor Note:** The data generator produces realistic commit patterns: some days heavy on AI, some days heavy on human, occasional dips in acceptance rate. Ask participants to identify the "bad day" in the generated data -- it builds dashboard literacy.

---

### [22-30 min] Exercise 3: Configure Alarms

Direct participants to `exercises/03-configure-alarms.md`.

They will:
1. Create a CloudWatch alarm for AI acceptance rate dropping below 70%
2. Create an alarm for deployment frequency anomaly
3. Understand what actionable alerts look like vs. noise

---

---

### Dashboard Sections Reference

The Team Velocity and Executive Readout dashboards include these sections:

**Team Velocity Dashboard** (for developers, hourly updates):

| Section | Key Widgets | What It Answers |
|---|---|---|
| DORA & AI-DORA | Acceptance rate, deploy freq, lead time, eval gate gauge, CFR, MTTR, merge ratio | "Are we getting faster and staying reliable?" |
| Agent Operations | Invocations, success rate, avg duration | "How are our agents performing?" |
| Eval Gate by Rubric | Pass rate per rubric (5 rubrics), eval score trend | "Which rubric is failing most? Is AI quality improving?" |
| Guardrails & Safety | Triggers by category, block vs anonymize | "Are guardrails catching issues? Any prompt attacks?" |
| MCP Governance | Tool call volume, auth denied rate | "What are agents accessing? Any unauthorized attempts?" |
| Cost Intelligence | Token usage (input/output), cost per commit, Bedrock cost, token efficiency | "What does AI cost us per commit? Are we efficient?" |
| AI Attribution | AI vs human defect rate, spec-to-code hours | "Is AI code more or less reliable than human code?" |
| Security Agent Findings | Critical/High count, finding trend by severity, remediation time, exploits, AI vs human findings, phase breakdown | "What vulnerabilities has Security Agent found? Are we fixing them fast enough?" |

**Executive Readout Dashboard** (for CTOs/VPEs, 7-day/30-day):

| Section | Key Widgets | What It Answers |
|---|---|---|
| Strategic Overview | PRISM level, DORA summary (5 KPIs), spec-to-code avg | "How mature are we? What's our velocity?" |
| AI Contribution Trend | Acceptance rate + merge ratio + test coverage (3-line) | "Is AI adoption growing or plateauing?" |
| Quality Gates | Eval pass rate gauge, defect rate trend, deploy freq bars | "Is AI code good enough? Are we deploying more?" |
| Security & Compliance | Guardrail blocks, trigger trend, MCP denied, exfiltration alerts | "Are we safe? Any compliance concerns?" |
| Cost Intelligence | Weekly Bedrock cost, cost per deploy, AI vs human defect rate | "What's the ROI? Is AI code worth it?" |

**CISO Compliance Dashboard** (for CISOs/security leaders, 30-day):

| Section | Key Widgets | What It Answers |
|---|---|---|
| Security Posture | Open critical findings, validated exploits, avg remediation time, scan volume | "What's our overall security posture?" |
| AI Code Risk Profile | Findings by code origin, remediation time by origin | "Is AI-generated code introducing more security issues?" |
| Shift-Left Effectiveness | Findings by phase (design/code/pen test), guardrail + exfiltration trends | "Are teams catching issues earlier in the lifecycle?" |

**Alarms (12 total):**

| Alarm | Threshold | What It Catches |
|---|---|---|
| AI Acceptance Rate Low | < 20% for 6h | Developers rejecting AI output |
| Eval Gate Pass Rate Low | < 70% for 6h | AI code quality degrading |
| Change Failure Rate High | > 20% for 6h | Deployment reliability issues |
| Agent Success Rate Low | < 80% for 1h | Agent failures |
| Guardrail Block Rate High | > 50/hr | Prompt attacks or misconfiguration |
| Bedrock Daily Cost High | > $100/day | Budget overrun |
| Token Efficiency Low | > 500 tokens/line for 6h | Inefficient prompting |
| Exfiltration Alert | >= 1 alert | Anomalous data access |
| Security Critical Finding | >= 1/hr | Critical/High Security Agent finding |
| Pen Test Exploit Detected | >= 1 | Validated exploit from pen testing |
| Security Remediation SLA | avg > 72h/24h | Teams not fixing findings fast enough |
| Security Finding Rate High | > 50/6h | Systemic security quality issue |

> **Instructor Note:** Each widget has a circled "i" info tooltip that explains the metric on hover. Point this out — it's useful for developers exploring the dashboard after the workshop.

**Mock dashboards:** See the [Executive Dashboard](../../docs/dashboard-executive.html) and [Team Dashboard](../../docs/dashboard-team.html) for live examples with sample data.

---

### [30 min] Wrap-Up: Full Workshop Review

This is the final module. Tie everything together:

**The complete AI-DLC flow you've built today:**

```
1. Write a spec in Kiro format                    (Module 03)
2. Configure Claude Code with CLAUDE.md            (Module 01)
3. Build agents with MCP auth + guardrails         (Module 02)
4. Implement the spec with Claude Code             (Module 03)
5. Git hooks auto-tag the commit with metadata     (Module 04)
6. Push to GitHub, CI emits metrics to EventBridge (Module 04)
7. Eval gate checks code quality with Bedrock      (Module 05)
8. Token/cost tracked via CloudTrail pipeline      (Automatic)
9. Team dashboard shows velocity in real-time      (Module 06)
10. Exec dashboard shows security, cost, quality   (Module 06)
```

**PRISM maturity levels — where are you now?**

| Level | Description | What You Built Today |
|-------|------------|---------------------|
| L1 | Ad-hoc AI usage, no tracking | — |
| L1.5 | Claude Code configured, some tracking | Module 01 |
| L2 | Spec-driven, metrics flowing, basic eval | Modules 02-04 |
| L2.5 | Eval gates, agent governance, dashboards | Modules 05-06 |
| L3 | Full pipeline: cost tracking, guardrails, attribution, exec visibility | Workshop complete |

**The homework:** Take what you built today back to your real project. Start with:
1. Add CLAUDE.md + AI-DLC steering files to your repo (30 minutes)
2. Install the git hooks (10 minutes)
3. Deploy the dashboard stack (1 CDK deploy — includes all dashboards, alarms, token pipeline)
4. Seed the identity mapping table with your team's IAM → developer mappings
5. Add eval gates once you have 2 weeks of baseline data

---

## Common Questions

**Q: How much does the infrastructure cost?**
A: For a team of 20 engineers: Timestream ~$5-10/month (mostly write costs), CloudWatch dashboard is free (included), EventBridge is negligible at this volume, QuickSight is $18/author/month (only needed for exec dashboard). Total: under $50/month.

**Q: Can we use Grafana instead of CloudWatch?**
A: Yes. The data is in Timestream and EventBridge -- you can point any visualization tool at it. CloudWatch is used in the workshop because it requires zero additional setup in an AWS account.

**Q: How long until we see meaningful trends?**
A: You need at least 2 weeks of data to see patterns and 4-6 weeks to establish baselines. Don't set aggressive thresholds until you have a month of data. Let the team establish its natural rhythm first, then optimize.

**Q: What does "good" look like at L3?**
A: There's no universal target. A healthy L3 team typically shows: AI contribution ratio 40-70%, AI acceptance rate >85%, deployment frequency increasing or stable, lead time decreasing, eval gate false positive rate <5%. But your team's specific targets depend on your domain and risk tolerance.

---

## Deep Dive Resources

| Resource | Description |
|----------|-------------|
| **[Data Architecture & Dashboard Guide](../../docs/data-architecture.md)** | Complete pipeline: 8 data sources, 14 event types, 5 specialized Lambdas, dashboard widget-by-widget guide, CloudWatch metrics catalog |
| **[Executive Dashboard (Mock)](../../docs/dashboard-executive.html)** | Interactive mock with sample data — DORA, security, cost intelligence sections with info tooltips |
| **[Team Dashboard (Mock)](../../docs/dashboard-team.html)** | Interactive mock — DORA, eval by rubric, guardrails, MCP, cost, attribution sections with info tooltips |
| **[Competitive Landscape](../../docs/competitive-landscape.md)** | How PRISM compares to Swarmia, Jellyfish, LinearB, DX, Faros AI |
| **[Community Roadmap](../../docs/ROADMAP.md)** | Prioritized backlog items including benchmarking, developer sentiment, and multi-org support |
| **[AI-DLC Steering Files](../../bootstrapper/aidlc-steering/)** | Development workflow rules adapted from [awslabs/aidlc-workflows](https://github.com/awslabs/aidlc-workflows) |
