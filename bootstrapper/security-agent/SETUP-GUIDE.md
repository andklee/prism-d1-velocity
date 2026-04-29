# AWS Security Agent — Setup Guide

Step-by-step guide to configure AWS Security Agent and connect it to the PRISM D1 metrics pipeline. Complete these steps in order.

---

## Prerequisites

- AWS account with Security Agent enabled (preview access required)
- PRISM D1 CDK stack deployed (`npx cdk deploy --all`)
- GitHub Enterprise repository (for code review integration)
- Domain you own (for pen testing scope)
- PRISM API URL and API key (from CDK outputs)

---

## Step 1: Enable AWS Security Agent

1. Open the [AWS Security Agent console](https://console.aws.amazon.com/securityagent)
2. If this is your first time, click **Get Started**
3. Review and accept the service terms
4. The CDK stack has already created an AgentSpace (`prism-d1-security`) — you should see it listed

> If the AgentSpace doesn't appear, verify the CDK stack deployed successfully: `npx cdk list` should show `PrismD1MetricsPipelineStack`.

---

## Step 2: Verify Your Target Domain

Security Agent requires domain ownership verification before pen testing.

### Option A: DNS TXT Record

1. In the Security Agent console, go to **Target Domains** → **Add Domain**
2. Enter your application's domain (e.g., `api.yourcompany.com`)
3. Select **DNS TXT** as the verification method
4. Copy the TXT record value provided
5. Add the TXT record to your DNS provider:
   ```
   Type:  TXT
   Name:  _securityagent.api.yourcompany.com
   Value: <paste the verification value>
   TTL:   300
   ```
6. Click **Verify** — may take up to 5 minutes for DNS propagation
7. Status should change to **Verified**

### Option B: HTTP Route

1. Select **HTTP Route** as the verification method
2. Download the verification file provided
3. Host the file at `https://api.yourcompany.com/.well-known/security-agent-verification`
4. Click **Verify**

> The CDK construct can also create target domains via `CfnTargetDomain`. To add domains via CDK instead of console, update `metrics-pipeline-stack.ts`:
> ```typescript
> this.securityAgent = new SecurityAgentConstruct(this, 'SecurityAgent', {
>   agentSpaceName: 'prism-d1-security',
>   targetDomains: [
>     { domainName: 'api.yourcompany.com', verificationMethod: 'DNS_TXT' },
>   ],
> });
> ```

---

## Step 3: Connect GitHub Enterprise for Code Review

1. In the Security Agent console, go to **Integrations** → **Code Review**
2. Click **Connect GitHub**
3. Select **GitHub Enterprise** and enter your organization URL
4. Authorize Security Agent to access your repositories
5. Select which repositories to monitor (start with your PRISM-instrumented repos)
6. Configure review triggers:
   - **On PR opened** — recommended
   - **On PR updated** — optional (more thorough, higher cost)

> Security Agent will now automatically review PRs in the connected repositories. Findings appear in the Security Agent console and, once the webhook is configured (Step 6), flow into PRISM dashboards.

---

## Step 4: Define Organizational Security Policies

1. Go to **Security Policies** in the Security Agent console
2. Click **Create Policy**
3. Configure policies that match your organization's requirements:

**Recommended starting policies:**

| Policy | What It Enforces | Maps to PRISM Rule |
|---|---|---|
| Encryption at rest required | All data stores must use KMS | SECURITY-01 |
| No hardcoded secrets | API keys, passwords, tokens blocked | SECURITY-03 |
| Input validation required | All API endpoints must validate input | SECURITY-05 |
| Least-privilege IAM | No wildcard actions or resources | SECURITY-06 |
| OWASP Top 10 coverage | SQL injection, XSS, CSRF, etc. | SECURITY-05 |

4. Assign policies to repositories or teams
5. Set enforcement level: **Block** (prevent merge) or **Warn** (advisory)

> These policies complement the PRISM `security-compliance` eval rubric. Security Agent enforces at the PR level; the eval rubric scores at the code level. Both must pass for merge.

---

## Step 5: Configure Design Review

Design review analyzes specs and design documents for architectural security risks before code is written.

### Manual upload (current)

1. Go to **Design Review** in the Security Agent console
2. Click **Upload Document**
3. Upload your spec file (e.g., `specs/user-auth.md`)
4. Review the findings — architectural risks, missing security requirements
5. Download the findings report

### Automated trigger (when available)

The `prism-security-agent-scan.yml` GitHub Actions workflow is configured to trigger design review when files in `specs/` or `docs/design/` are committed. Currently this emits a scan event to PRISM; when the Security Agent API supports programmatic design review, the workflow will call the API directly.

---

## Step 6: Configure Webhook to PRISM

This connects Security Agent findings to the PRISM metrics pipeline.

1. In the Security Agent console, go to **Settings** → **Notifications**
2. Click **Add Webhook**
3. Configure:
   ```
   URL:     https://<your-api-id>.execute-api.<region>.amazonaws.com/v1/security-findings
   Method:  POST
   Headers: x-api-key: <your-prism-api-key>
   Events:  All finding types (design review, code review, pen test)
   Format:  JSON
   ```
4. Click **Test** to verify the connection
5. You should see a `200 OK` response

> Get your API URL and key from CDK outputs:
> ```bash
> aws cloudformation describe-stacks \
>   --stack-name PrismD1ApiStack \
>   --query 'Stacks[0].Outputs' \
>   --output table
> ```

### Verify findings flow to PRISM

1. Trigger a code review (push a PR to a connected repo)
2. Wait for Security Agent to complete the review
3. Check the PRISM API for findings:
   ```bash
   curl -s "https://<api-url>/v1/security-findings/<team-id>?hours=24" \
     -H "x-api-key: <api-key>" | jq '.count'
   ```
4. Open CloudWatch → Dashboards → `PRISM-D1-Team-Velocity` → "Security Agent Findings" section

---

## Step 7: Seed Developer Identity Mapping

The PRISM token and security pipelines attribute findings to developers via IAM principal mapping. Without this, developer_email defaults to "unknown."

```bash
# For each developer on the team:
aws dynamodb put-item \
  --table-name prism-identity-mapping \
  --item '{
    "iam_principal": {"S": "arn:aws:iam::123456789012:role/developer-jane"},
    "developer_email": {"S": "jane@company.com"},
    "team_id": {"S": "team-alpha"},
    "display_name": {"S": "Jane Developer"}
  }'
```

For SSO/Identity Center users, the IAM principal is the role ARN assumed via federation.

> To find IAM principals used by your team:
> ```bash
> aws cloudtrail lookup-events \
>   --lookup-attributes AttributeKey=EventSource,AttributeValue=bedrock.amazonaws.com \
>   --max-results 20 \
>   --query 'Events[].{User:Username,ARN:Resources[0].ResourceName}' \
>   --output table
> ```

---

## Step 8: Run the PRISM Setup Script

After completing the console setup, run the PRISM-side configuration:

```bash
cd your-repo

# Run setup
chmod +x /path/to/bootstrapper/security-agent/setup.sh
/path/to/bootstrapper/security-agent/setup.sh \
  --api-url https://<api-id>.execute-api.<region>.amazonaws.com/v1 \
  --api-key <your-api-key> \
  --team-id team-alpha

# Copy the GitHub workflow
cp /path/to/bootstrapper/security-agent/prism-security-agent-scan.yml .github/workflows/
```

This creates `.prism/security-agent.json` with scan triggers and remediation SLA thresholds.

---

## Step 9: Verify End-to-End

Run through the complete flow to verify everything is connected:

### Design Review
1. Commit a new spec to `specs/` → push to main
2. Upload the spec in Security Agent console → review findings
3. Check: `prism.d1.security.design_review` events appear in DynamoDB

### Code Review
1. Open a PR with AI-generated code
2. Security Agent automatically reviews the PR
3. Check: findings appear as PR comments AND in PRISM dashboard

### Pen Test
1. In Security Agent console → **Pentests** → **Start Pentest**
2. Select your AgentSpace and target domain
3. Wait for completion (typically minutes to hours)
4. Check: `prism.d1.security.pen_test` events in PRISM dashboard

### Dashboards
1. Open `PRISM-D1-Team-Velocity` → "Security Agent Findings" section populated
2. Open `PRISM-D1-CISO-Compliance` → security posture, AI risk profile visible
3. Check that the `SecurityCriticalFinding` alarm is in OK state

---

## Troubleshooting

**Domain verification stuck on "Pending"**
- DNS TXT: check propagation with `dig TXT _securityagent.yourdomain.com`
- HTTP: verify the file is accessible at the exact path with `curl https://yourdomain.com/.well-known/security-agent-verification`

**No findings appearing in PRISM**
- Verify webhook URL is correct (test with curl)
- Check the `security-agent-processor` Lambda logs in CloudWatch
- Verify the API key matches (check API Gateway usage plan)

**Code review not triggering on PR**
- Verify GitHub connection is active in Security Agent console
- Check the repository is selected for monitoring
- Ensure the PR targets a monitored branch

**Identity mapping shows "unknown"**
- Verify the IAM principal ARN matches exactly (case-sensitive)
- Check CloudTrail for the actual ARN used during Bedrock calls
- For SSO: use the assumed role ARN, not the user ARN

**Eval gate not blocking on Critical findings**
- Verify the `security-compliance.json` rubric has the `security_agent_findings` criterion
- Check that the `security-response-automator` Lambda wrote a penalty record to DynamoDB
- Verify the eval gate workflow queries for `prism.d1.security.penalty` records

---

## What Gets Created

| Resource | Created By | Purpose |
|---|---|---|
| AgentSpace | CDK (`SecurityAgentConstruct`) | Scope, integrations, KMS encryption |
| Target Domain | Console (or CDK) | Pen test scope with ownership verification |
| GitHub Connection | Console | Code review on PRs |
| Security Policies | Console | Organizational security rules |
| Webhook | Console | Forward findings to PRISM API |
| IAM Service Role | CDK | Least-privilege for pen tests |
| Log Group | CDK | Pen test results (6-month retention) |
| `.prism/security-agent.json` | `setup.sh` | Local config for scan triggers + SLAs |
| GitHub workflow | Copied from bootstrapper | Automated scan triggers |
| Identity mapping | Manual (`dynamodb put-item`) | IAM → developer attribution |
