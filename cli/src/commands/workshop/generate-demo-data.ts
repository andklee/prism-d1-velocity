import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '../../../..');

function run(cmd: string): boolean {
  try {
    execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], cwd: ROOT_DIR });
    return true;
  } catch {
    return false;
  }
}

function runCapture(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], cwd: ROOT_DIR }).trim();
  } catch {
    return '';
  }
}

function putEvents(region: string, entries: object[]): boolean {
  try {
    execSync(
      `aws events put-events --region "${region}" --entries '${JSON.stringify(entries)}'`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], cwd: ROOT_DIR }
    );
    return true;
  } catch {
    return false;
  }
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default {
  description: 'Generate sample metrics data for the PRISM dashboard (8 days of events)',
  options: [
    { flags: '--region <region>', description: 'AWS region', default: 'us-west-2' },
    { flags: '--bus <name>', description: 'EventBridge bus name', default: 'prism-d1-metrics' },
    { flags: '--team <id>', description: 'Team identifier', default: 'demo-team' },
    { flags: '--repo <name>', description: 'Repository name', default: 'prism-d1-sample-app' },
  ],
  action(options: { region: string; bus: string; team: string; repo: string }) {
    const { region, bus, team, repo } = options;

    // Verify AWS CLI and jq are available
    if (!run('command -v aws')) {
      console.error('Error: AWS CLI not found. Install from https://aws.amazon.com/cli/');
      process.exit(1);
    }
    if (!run('command -v jq')) {
      console.error('Error: jq not found. Install with: apt-get install jq');
      process.exit(1);
    }

    console.log('=== PRISM Demo Data Generator ===');
    console.log(`Region: ${region} | Bus: ${bus} | Team: ${team}`);
    console.log('');

    const ORIGINS = ['human', 'ai-assisted', 'ai-generated', 'ai-assisted', 'ai-assisted'];
    const TOOLS = ['n/a', 'claude-code', 'claude-code', 'kiro', 'claude-code'];

    let batch: object[] = [];
    let total = 0;

    function flush() {
      if (batch.length > 0) {
        if (putEvents(region, batch)) {
          total += batch.length;
        } else {
          console.error(`Warning: Failed to emit batch of ${batch.length} events`);
        }
        batch = [];
      }
    }

    function addEvent(detailType: string, detail: object) {
      batch.push({
        Source: 'prism.d1.velocity',
        DetailType: detailType,
        EventBusName: bus,
        Detail: JSON.stringify(detail),
      });
      if (batch.length >= 10) {
        flush();
        process.stdout.write('.');
      }
    }

    for (let day = 7; day >= 0; day--) {
      const date = new Date();
      date.setDate(date.getDate() - day);
      const dateStr = formatDate(date);
      const maxH = day === 0 ? Math.max(0, new Date().getUTCHours() - 1) : 17;
      const minH = Math.min(8, maxH);

      // 8-15 commits per day
      const commits = randomInt(8, 15);
      for (let i = 0; i < commits; i++) {
        const idx = randomInt(0, 4);
        const origin = ORIGINS[idx];
        const tool = TOOLS[idx];
        const h = randomInt(minH, maxH);
        const m = randomInt(0, 59);
        const ts = `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;
        const lines = randomInt(10, 129);

        addEvent('prism.d1.commit', {
          team_id: team, repo, timestamp: ts, prism_level: 2,
          metric: { name: 'commit', value: 1, unit: 'count' },
          ai_context: { tool, model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', origin },
          ai_dora: { ai_to_merge_ratio: origin !== 'human' ? 1 : 0 },
        });
      }

      // 2-4 PRs per day
      const prs = randomInt(2, 4);
      for (let i = 0; i < prs; i++) {
        const tc = randomInt(2, 6);
        const ac = randomInt(0, tc);
        const ratio = parseFloat((ac / tc).toFixed(4));
        const lt = 3600 * (day + 1) + randomInt(0, 3599);
        const lth = parseFloat((lt / 3600).toFixed(2));
        const ts = `${dateStr}T${String(randomInt(minH, maxH)).padStart(2, '0')}:30:00Z`;
        const pr = 100 + day * 10 + i;

        // Generate realistic token usage for the PR (scales with commit count)
        const inputTokens = ac > 0 ? randomInt(5000, 15000) * tc : 0;
        const outputTokens = ac > 0 ? randomInt(10000, 40000) * tc : 0;
        const costUsd = ac > 0 ? parseFloat(((inputTokens * 0.003 + outputTokens * 0.015) / 100).toFixed(2)) : 0;

        addEvent('prism.d1.pr', {
          team_id: team, repo, timestamp: ts, prism_level: 2,
          metric: { name: 'ai_to_merge_ratio', value: ratio, unit: 'ratio' },
          ai_context: { tool: 'github-actions', model: 'n/a', origin: ac > 0 ? 'ai-assisted' : 'human' },
          dora: { deployment_frequency: 1, lead_time_seconds: lt },
          ai_dora: {
            ai_to_merge_ratio: ratio,
            total_commits: tc,
            ai_commits: ac,
            total_input_tokens: inputTokens,
            total_output_tokens: outputTokens,
            total_cost_usd: costUsd,
          },
          pr: { number: pr, author: 'engineer' },
        });

        // Deploy event
        addEvent('prism.d1.deploy', {
          team_id: team, repo, timestamp: ts, prism_level: 2,
          metric: { name: 'deployment', value: 1, unit: 'count' },
          dora: { deployment_frequency: 1 },
        });
      }

      // Eval results
      for (let i = 0; i < prs; i++) {
        let score = 0.88;
        let res = 'PASS';
        if (day === 4 && randomInt(0, 1) === 0) { score = 0.62; res = 'FAIL'; }
        if (randomInt(0, 7) === 0) { score = 0.71; res = 'FAIL'; }
        const ts = `${dateStr}T${String(randomInt(minH, maxH)).padStart(2, '0')}:45:00Z`;

        addEvent('prism.d1.eval', {
          team_id: team, repo, timestamp: ts, prism_level: 2,
          metric: { name: 'eval_score', value: score, unit: 'score' },
          ai_context: { tool: 'bedrock-eval', model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', origin: 'ai-generated' },
          ai_dora: { eval_gate_pass_rate: res === 'PASS' ? 1 : 0 },
          eval: { result: res, pr_number: 100 + day * 10 + i },
        });
      }

      // Weekly assessment metrics
      const ts = `${dateStr}T09:00:00Z`;
      const cfr = parseFloat(((randomInt(1, 8)) / 100).toFixed(4));
      const mttrS = randomInt(600, 4199);
      const accept = parseFloat((randomInt(70, 89) / 100).toFixed(4));
      const coverage = parseFloat((randomInt(10, 34) / 100).toFixed(4));
      const specH = parseFloat((randomInt(10, 39) / 10).toFixed(2));
      const defect = parseFloat((randomInt(1, 5) / 100).toFixed(4));

      addEvent('prism.d1.assessment', {
        team_id: team, repo, timestamp: ts, prism_level: 2,
        metric: { name: 'change_failure_rate', value: cfr, unit: 'percent' },
        dora: { change_failure_rate: cfr },
      });

      addEvent('prism.d1.assessment', {
        team_id: team, repo, timestamp: ts, prism_level: 2,
        metric: { name: 'mttr', value: mttrS, unit: 'seconds' },
        dora: { mttr_seconds: mttrS },
      });

      addEvent('prism.d1.assessment', {
        team_id: team, repo, timestamp: ts, prism_level: 2,
        metric: { name: 'ai_acceptance_rate', value: accept, unit: 'percent' },
        ai_dora: { ai_acceptance_rate: accept },
      });

      addEvent('prism.d1.assessment', {
        team_id: team, repo, timestamp: ts, prism_level: 2,
        metric: { name: 'ai_test_coverage_delta', value: coverage, unit: 'percent' },
        ai_dora: { ai_test_coverage_delta: coverage },
      });

      addEvent('prism.d1.assessment', {
        team_id: team, repo, timestamp: ts, prism_level: 2,
        metric: { name: 'spec_to_code_hours', value: specH, unit: 'count' },
        ai_dora: { spec_to_code_hours: specH },
      });

      addEvent('prism.d1.assessment', {
        team_id: team, repo, timestamp: ts, prism_level: 2,
        metric: { name: 'post_merge_defect_rate', value: defect, unit: 'percent' },
        ai_dora: { post_merge_defect_rate: defect },
      });

      // PRISM Level (trending up over the week)
      const level = parseFloat((1.5 + (7 - day) * 0.2).toFixed(1));
      addEvent('prism.d1.assessment', {
        team_id: team, repo, timestamp: ts, prism_level: 2,
        metric: { name: 'PRISMLevel', value: level, unit: 'none' },
      });

      // Agent invocations
      const agentCount = randomInt(3, 10);
      for (let a = 0; a < agentCount; a++) {
        const steps = randomInt(2, 9);
        const dur = randomInt(1000, 5999);
        const tokens = randomInt(2000, 9999);
        const status = randomInt(0, 5) === 0 ? 'failure' : 'success';
        const ats = `${dateStr}T${String(randomInt(minH, maxH)).padStart(2, '0')}:${String(randomInt(0, 59)).padStart(2, '0')}:00Z`;

        addEvent('prism.d1.agent', {
          team_id: team, repo, timestamp: ats, prism_level: 3,
          metric: { name: 'agent_invocation', value: 1, unit: 'count' },
          ai_context: { tool: 'strands-agent', model: 'us.anthropic.claude-haiku-4-5-20251001-v1:0', origin: 'ai-generated' },
          agent: {
            agent_name: 'task-assistant', steps_taken: steps, tools_invoked: steps - 1,
            duration_ms: dur, tokens_used: tokens, status, guardrails_triggered: 0,
          },
        });
      }
    }

    flush();
    console.log('\n');
    console.log(`=== Done! ${total} events emitted ===`);
    console.log('Open CloudWatch → Dashboards → PRISM-D1-Team-Velocity (us-west-2)');
    console.log("Set time range to 'Last 1 week'");
  },
};
