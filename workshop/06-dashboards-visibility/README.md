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

### [30 min] Wrap-Up: Full Workshop Review

This is the final module. Tie everything together:

**The complete AI-DLC flow you've built today:**

```
1. Write a spec in Kiro format                    (Module 02)
2. Configure Claude Code with CLAUDE.md            (Module 01)
3. Implement the spec with Claude Code             (Module 02)
4. Git hooks auto-tag the commit with metadata     (Module 03)
5. Push to GitHub, CI emits metrics to EventBridge (Module 03)
6. Eval gate checks code quality with Bedrock      (Module 04)
7. Metrics flow to Timestream                      (Module 05)
8. Team dashboard shows velocity in real-time      (Module 05)
9. Exec dashboard shows weekly/monthly trends      (Module 05)
```

**PRISM maturity levels -- where are you now?**

| Level | Description | What You Built Today |
|-------|------------|---------------------|
| L1 | Ad-hoc AI usage, no tracking | -- |
| L1.5 | Claude Code configured, some tracking | Module 01 |
| L2 | Spec-driven, metrics flowing, basic eval | Modules 02-04 |
| L2.5 | Dashboards deployed, team reviewing weekly | Module 05 |
| L3 | Full pipeline, exec visibility, iterating on thresholds | Workshop complete |

**The homework:** Take what you built today back to your real project. Start with:
1. Add CLAUDE.md to your main repo (30 minutes)
2. Install the git hooks (10 minutes)
3. Deploy the dashboard (1 CDK deploy)
4. Add eval gates once you have 2 weeks of baseline data

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
| **[Data Architecture](../../docs/data-architecture.md)** | Complete pipeline documentation: 7 data sources, 8 event types, AI tool detection logic, CloudWatch metrics catalog, processing and storage details |
| **[Competitive Landscape](../../docs/competitive-landscape.md)** | How PRISM dashboards compare to Swarmia, Jellyfish, LinearB, DX, Faros AI — where we lead and where we trail |
| **[Community Roadmap](../../docs/ROADMAP.md)** | 47 backlog items including dashboard gap fixes, token/cost intelligence, benchmarking, and developer sentiment |

### Known Gaps in Current Dashboards

The current dashboard implementation has specific gaps between the Executive and Developer views. Quality signals (defect rates, test coverage) don't bubble up to executives, and maturity context (PRISM level) doesn't flow down to developers. Neither tier surfaces incident data or token/cost tracking.

See the [Data Architecture — Current Gap: Token Usage & Cost Tracking](../../docs/data-architecture.md#current-gap-token-usage--cost-tracking) section for details on what's missing and the proposed Bedrock CloudTrail → Token Pipeline solution.
