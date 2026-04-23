import {
  DynamoDBClient,
  PutItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  CloudWatchClient,
  PutMetricDataCommand,
  MetricDatum,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';

// ---- Types ----

interface AiContext {
  tool: string;
  model: string;
  origin: string;
}

interface DoraMetrics {
  deployment_frequency: number | null;
  lead_time_seconds: number | null;
  change_failure_rate: number | null;
  mttr_seconds: number | null;
}

interface AiDoraMetrics {
  ai_acceptance_rate: number | null;
  ai_to_merge_ratio: number | null;
  spec_to_code_hours: number | null;
  post_merge_defect_rate: number | null;
  eval_gate_pass_rate: number | null;
  ai_test_coverage_delta: number | null;
}

interface MetricDetail {
  team_id: string;
  repo: string;
  timestamp: string;
  prism_level: number | string;
  metric: { name: string; value: number; unit: string };
  ai_context?: AiContext;
  dora?: DoraMetrics;
  ai_dora?: AiDoraMetrics;
  agent?: {
    agent_name: string;
    steps_taken: number;
    tools_invoked: number;
    duration_ms: number;
    tokens_used: number;
    status: string;
    guardrails_triggered: number;
  };
}

interface EventBridgeEvent {
  source: string;
  'detail-type': string;
  detail: MetricDetail;
}

// ---- Clients (reused across invocations) ----

const dynamoClient = new DynamoDBClient({});
const cloudwatchClient = new CloudWatchClient({});

const EVENTS_TABLE = process.env.EVENTS_TABLE!;
const METADATA_TABLE = process.env.METADATA_TABLE!;
const METRIC_NAMESPACE = process.env.METRIC_NAMESPACE ?? 'PRISM/D1/Velocity';

// ---- Handler ----

export async function handler(event: EventBridgeEvent): Promise<void> {
  console.log('[metrics-processor] Received event:', JSON.stringify(event, null, 2));

  const detailType = event['detail-type'];
  const detail = event.detail;

  console.log(`[metrics-processor] detail-type=${detailType} team_id=${detail?.team_id} repo=${detail?.repo} timestamp=${detail?.timestamp}`);
  console.log(`[metrics-processor] dora=${JSON.stringify(detail?.dora)} ai_dora=${JSON.stringify(detail?.ai_dora)} metric=${JSON.stringify(detail?.metric)}`);

  if (!detail.team_id) {
    console.log('[metrics-processor] No team_id provided, defaulting to "no_team"');
    detail.team_id = 'no_team';
  }

  if (!detail.repo || !detail.timestamp) {
    console.error('[metrics-processor] VALIDATION FAILED: Missing required fields: repo or timestamp');
    throw new Error('Event missing required fields');
  }

  const results = await Promise.allSettled([
    writeEventToDynamo(detailType, detail),
    writeMetadataToDynamo(detailType, detail),
    publishCloudWatchMetrics(detailType, detail),
  ]);

  results.forEach((result, idx) => {
    const labels = ['writeEventToDynamo', 'writeMetadataToDynamo', 'publishCloudWatchMetrics'];
    if (result.status === 'fulfilled') {
      console.log(`[metrics-processor] ${labels[idx]} succeeded`);
    } else {
      console.error(`[metrics-processor] ${labels[idx]} FAILED:`, result.reason);
    }
  });

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    throw new Error(`${failures.length} operation(s) failed — check logs above`);
  }

  console.log(`[metrics-processor] Successfully processed ${detailType} for ${detail.team_id}/${detail.repo}`);
}

// ---- DynamoDB events ----

async function writeEventToDynamo(
  detailType: string,
  detail: MetricDetail,
): Promise<void> {
  console.log(`[writeEventToDynamo] Writing event: pk=${detail.team_id}#${detail.repo} sk=${detail.timestamp} type=${detailType}`);
  const ttl = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60; // 365 days from now

  const data: Record<string, unknown> = {
    team_id: detail.team_id,
    repo: detail.repo,
    prism_level: detail.prism_level ?? '1',
  };

  if (detail.metric) {
    data.metric = detail.metric;
  }
  if (detail.ai_context) {
    data.ai_context = detail.ai_context;
  }
  if (detail.dora) {
    data.dora = detail.dora;
  }
  if (detail.ai_dora) {
    data.ai_dora = detail.ai_dora;
  }

  await dynamoClient.send(
    new PutItemCommand({
      TableName: EVENTS_TABLE,
      Item: {
        pk: { S: `${detail.team_id}#${detail.repo}` },
        sk: { S: detail.timestamp },
        detail_type: { S: detailType },
        data: { S: JSON.stringify(data) },
        ttl: { N: ttl.toString() },
      },
    }),
  );
}

// ---- DynamoDB metadata ----

async function writeMetadataToDynamo(
  detailType: string,
  detail: MetricDetail,
): Promise<void> {
  console.log(`[writeMetadataToDynamo] Writing metadata: team_id=${detail.team_id} repo=${detail.repo} type=${detailType}`);
  const item: Record<string, { S?: string; N?: string }> = {
    team_id: { S: detail.team_id },
    repo: { S: detail.repo },
    last_event_type: { S: detailType },
    last_updated: { S: detail.timestamp },
    prism_level: { N: String(detail.prism_level ?? 1) },
  };

  if (detail.ai_context?.tool) {
    item.ai_tool = { S: detail.ai_context.tool };
  }
  if (detail.ai_context?.origin) {
    item.ai_origin = { S: detail.ai_context.origin };
  }

  // For assessment events, store the full PRISM level and primary metric
  if (detailType === 'prism.d1.assessment' && detail.metric) {
    item.assessment_metric = { S: detail.metric.name };
    item.assessment_value = { N: detail.metric.value.toString() };
  }

  // Store latest DORA snapshot — only numeric fields as N attributes
  if (detail.dora) {
    for (const [key, val] of Object.entries(detail.dora)) {
      if (val == null) continue;
      if (typeof val === 'number') {
        item[`dora_${key}`] = { N: val.toString() };
      } else if (typeof val === 'string' && !isNaN(Number(val))) {
        item[`dora_${key}`] = { N: val };
      }
      // Skip non-numeric values (e.g. deploy_sha) — they don't belong in N attributes
    }
  }

  // Store latest AI-DORA snapshot — only numeric fields
  if (detail.ai_dora) {
    for (const [key, val] of Object.entries(detail.ai_dora)) {
      if (val == null) continue;
      if (typeof val === 'object') continue; // Skip nested objects like tool_breakdown
      if (typeof val === 'number') {
        item[`ai_dora_${key}`] = { N: val.toString() };
      } else if (typeof val === 'string' && !isNaN(Number(val))) {
        item[`ai_dora_${key}`] = { N: val };
      }
    }
  }

  await dynamoClient.send(
    new PutItemCommand({
      TableName: METADATA_TABLE,
      Item: item,
    }),
  );
}

// ---- CloudWatch custom metrics ----

async function publishCloudWatchMetrics(
  detailType: string,
  detail: MetricDetail,
): Promise<void> {
  console.log(`[publishCloudWatchMetrics] Starting for ${detailType}, namespace=${METRIC_NAMESPACE}`);
  console.log(`[publishCloudWatchMetrics] dora fields: deployment_frequency=${detail.dora?.deployment_frequency} lead_time_seconds=${detail.dora?.lead_time_seconds} change_failure_rate=${detail.dora?.change_failure_rate} mttr_seconds=${detail.dora?.mttr_seconds}`);
  console.log(`[publishCloudWatchMetrics] ai_dora fields: ai_acceptance_rate=${detail.ai_dora?.ai_acceptance_rate} ai_to_merge_ratio=${detail.ai_dora?.ai_to_merge_ratio} eval_gate_pass_rate=${detail.ai_dora?.eval_gate_pass_rate}`);

  const sharedDimensions = [
    { Name: 'TeamId', Value: detail.team_id },
    { Name: 'Repository', Value: detail.repo },
  ];

  // Add AIOrigin dimension when available — enables dashboard filtering
  // by ai-generated vs ai-assisted vs human
  const aiOrigin = detail.ai_context?.origin;
  const dimensionsWithOrigin = aiOrigin
    ? [...sharedDimensions, { Name: 'AIOrigin', Value: aiOrigin }]
    : sharedDimensions;

  const metricData: MetricDatum[] = [];

  // Primary metric — published with both dimension sets for flexibility:
  // 1. With AIOrigin: allows filtering by origin type
  // 2. Without AIOrigin: allows aggregate queries across all origins
  if (detail.metric?.value != null) {
    metricData.push({
      MetricName: detail.metric.name,
      Value: detail.metric.value,
      Unit: mapUnit(detail.metric.unit),
      Dimensions: sharedDimensions,
      Timestamp: new Date(detail.timestamp),
    });
    if (aiOrigin) {
      metricData.push({
        MetricName: detail.metric.name,
        Value: detail.metric.value,
        Unit: mapUnit(detail.metric.unit),
        Dimensions: dimensionsWithOrigin,
        Timestamp: new Date(detail.timestamp),
      });
    }
  }

  // DORA metrics — published with AIOrigin dimension when available
  if (detail.dora) {
    const doraDims = aiOrigin ? dimensionsWithOrigin : sharedDimensions;
    if (detail.dora.deployment_frequency != null) {
      metricData.push({
        MetricName: 'DeploymentFrequency',
        Value: detail.dora.deployment_frequency,
        Unit: StandardUnit.Count,
        Dimensions: sharedDimensions,
        Timestamp: new Date(detail.timestamp),
      });
      if (aiOrigin) {
        metricData.push({
          MetricName: 'DeploymentFrequency',
          Value: detail.dora.deployment_frequency,
          Unit: StandardUnit.Count,
          Dimensions: doraDims,
          Timestamp: new Date(detail.timestamp),
        });
      }
    }
    if (detail.dora.lead_time_seconds != null) {
      metricData.push({
        MetricName: 'LeadTimeForChanges',
        Value: detail.dora.lead_time_seconds,
        Unit: StandardUnit.Seconds,
        Dimensions: sharedDimensions,
        Timestamp: new Date(detail.timestamp),
      });
      if (aiOrigin) {
        metricData.push({
          MetricName: 'LeadTimeForChanges',
          Value: detail.dora.lead_time_seconds,
          Unit: StandardUnit.Seconds,
          Dimensions: doraDims,
          Timestamp: new Date(detail.timestamp),
        });
      }
    }
    if (detail.dora.change_failure_rate != null) {
      metricData.push({
        MetricName: 'ChangeFailureRate',
        Value: detail.dora.change_failure_rate,
        Unit: StandardUnit.Percent,
        Dimensions: sharedDimensions,
        Timestamp: new Date(detail.timestamp),
      });
    }
    if (detail.dora.mttr_seconds != null) {
      metricData.push({
        MetricName: 'MTTR',
        Value: detail.dora.mttr_seconds,
        Unit: StandardUnit.Seconds,
        Dimensions: sharedDimensions,
        Timestamp: new Date(detail.timestamp),
      });
    }
  }

  // AI-DORA metrics
  if (detail.ai_dora) {
    const aiDoraMap: Array<[string, number | null, StandardUnit]> = [
      ['AIAcceptanceRate', detail.ai_dora.ai_acceptance_rate, StandardUnit.Percent],
      ['AIToMergeRatio', detail.ai_dora.ai_to_merge_ratio, StandardUnit.Percent],
      ['SpecToCodeHours', detail.ai_dora.spec_to_code_hours, StandardUnit.Count],
      ['PostMergeDefectRate', detail.ai_dora.post_merge_defect_rate, StandardUnit.Percent],
      ['EvalGatePassRate', detail.ai_dora.eval_gate_pass_rate, StandardUnit.Percent],
      ['AITestCoverageDelta', detail.ai_dora.ai_test_coverage_delta, StandardUnit.Percent],
    ];

    for (const [name, value, unit] of aiDoraMap) {
      if (value != null) {
        metricData.push({
          MetricName: name,
          Value: value,
          Unit: unit,
          Dimensions: sharedDimensions,
          Timestamp: new Date(detail.timestamp),
        });
      }
    }
  }

  // Agent metrics
  if (detail.agent) {
    const agent = detail.agent;
    const agentDimensions = [
      ...sharedDimensions,
      { Name: 'AgentName', Value: agent.agent_name ?? 'unknown' },
    ];

    const agentMetrics: Array<[string, number | null, StandardUnit]> = [
      ['AgentInvocationCount', 1, StandardUnit.Count],
      ['AgentStepCount', agent.steps_taken ?? null, StandardUnit.Count],
      ['AgentDurationMs', agent.duration_ms ?? null, StandardUnit.Milliseconds],
      ['AgentTokensUsed', agent.tokens_used ?? null, StandardUnit.Count],
      ['AgentToolInvocationCount', agent.tools_invoked ?? null, StandardUnit.Count],
      ['AgentGuardrailTriggerCount', agent.guardrails_triggered ?? null, StandardUnit.Count],
      ['AgentSuccessRate', agent.status === 'success' ? 100 : 0, StandardUnit.Percent],
    ];

    for (const [name, value, unit] of agentMetrics) {
      if (value != null) {
        // Publish with AgentName dimension (for per-agent drill-down)
        metricData.push({
          MetricName: name,
          Value: value,
          Unit: unit,
          Dimensions: agentDimensions,
          Timestamp: new Date(detail.timestamp),
        });
        // Also publish without AgentName (for aggregate dashboard queries)
        metricData.push({
          MetricName: name,
          Value: value,
          Unit: unit,
          Dimensions: sharedDimensions,
          Timestamp: new Date(detail.timestamp),
        });
      }
    }
  }

  // Also publish all metrics WITHOUT dimensions for aggregate dashboard views.
  // CloudWatch treats dimensioned and dimensionless metrics as separate time series.
  // The dashboard-stack.ts widgets query without dimensions, so we need both.
  const dimensionlessMetrics: MetricDatum[] = metricData
    .filter((m) => m.Dimensions && m.Dimensions.length > 0)
    .map((m) => ({
      ...m,
      Dimensions: [],
    }));
  metricData.push(...dimensionlessMetrics);

  if (metricData.length === 0) {
    console.log('[publishCloudWatchMetrics] No metrics to publish — metricData is empty');
    return;
  }

  console.log(`[publishCloudWatchMetrics] Publishing ${metricData.length} metric data points`);
  metricData.forEach((m, i) => {
    console.log(`[publishCloudWatchMetrics]   [${i}] ${m.MetricName}=${m.Value} unit=${m.Unit} dims=${JSON.stringify(m.Dimensions)}`);
  });

  // CloudWatch accepts max 1000 metric data points per call; batch in chunks of 25
  const batchSize = 25;
  for (let i = 0; i < metricData.length; i += batchSize) {
    const batch = metricData.slice(i, i + batchSize);
    console.log(`[publishCloudWatchMetrics] Sending batch ${Math.floor(i / batchSize) + 1} with ${batch.length} metrics`);
    try {
      await cloudwatchClient.send(
        new PutMetricDataCommand({
          Namespace: METRIC_NAMESPACE,
          MetricData: batch,
        }),
      );
      console.log(`[publishCloudWatchMetrics] Batch ${Math.floor(i / batchSize) + 1} sent successfully`);
    } catch (err) {
      console.error(`[publishCloudWatchMetrics] Batch ${Math.floor(i / batchSize) + 1} FAILED:`, err);
      throw err;
    }
  }
}

function mapUnit(unit: string): StandardUnit {
  const unitMap: Record<string, StandardUnit> = {
    count: StandardUnit.Count,
    percent: StandardUnit.Percent,
    seconds: StandardUnit.Seconds,
    milliseconds: StandardUnit.Milliseconds,
    bytes: StandardUnit.Bytes,
    none: StandardUnit.None,
  };
  return unitMap[unit?.toLowerCase()] ?? StandardUnit.None;
}
