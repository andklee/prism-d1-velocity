import {
  DynamoDBClient,
  GetItemCommand,
} from '@aws-sdk/client-dynamodb';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';

const dynamoClient = new DynamoDBClient({});
const eventBridgeClient = new EventBridgeClient({});

const PRICING_TABLE = process.env.PRICING_TABLE!;
const IDENTITY_TABLE = process.env.IDENTITY_TABLE!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;

interface CloudTrailBedrockEvent {
  detail: {
    eventSource: string;
    eventName: string;
    eventTime: string;
    userAgent?: string;
    userIdentity: {
      type: string;
      arn: string;
      principalId: string;
      accountId: string;
    };
    requestParameters: {
      modelId?: string;
    };
    responseElements?: unknown;
    additionalEventData?: {
      inputTokenCount?: number;
      outputTokenCount?: number;
    };
  };
}

/**
 * Processes CloudTrail Bedrock API call events.
 * Extracts token counts, looks up pricing and developer identity,
 * then emits a prism.d1.token event to the PRISM event bus.
 */
export async function handler(event: CloudTrailBedrockEvent): Promise<void> {
  const detail = event.detail;
  console.log('Processing Bedrock API call:', detail.eventName, detail.requestParameters?.modelId);

  const modelId = detail.requestParameters?.modelId;
  if (!modelId) {
    console.log('No model ID in event, skipping');
    return;
  }

  // Extract token counts from additionalEventData
  const inputTokens = detail.additionalEventData?.inputTokenCount ?? 0;
  const outputTokens = detail.additionalEventData?.outputTokenCount ?? 0;

  if (inputTokens === 0 && outputTokens === 0) {
    console.log('No token data in event, skipping');
    return;
  }

  // Look up model pricing — with fuzzy model ID matching
  // CloudTrail may log: us.anthropic.claude-sonnet-4-20250514-v1:0
  // Pricing table has:  anthropic.claude-sonnet-4-20250514
  // We try: exact → stripped → base family fallback
  let costUsd = 0;
  const normalizedModelId = normalizeModelId(modelId);

  try {
    // Try exact match first
    let pricingResult = await dynamoClient.send(
      new GetItemCommand({
        TableName: PRICING_TABLE,
        Key: { model_id: { S: modelId } },
      }),
    );

    // If no exact match, try normalized (stripped prefix/suffix)
    if (!pricingResult.Item && normalizedModelId !== modelId) {
      pricingResult = await dynamoClient.send(
        new GetItemCommand({
          TableName: PRICING_TABLE,
          Key: { model_id: { S: normalizedModelId } },
        }),
      );
    }

    if (pricingResult.Item) {
      const inputCostPer1k = parseFloat(pricingResult.Item.input_cost_per_1k?.N ?? '0');
      const outputCostPer1k = parseFloat(pricingResult.Item.output_cost_per_1k?.N ?? '0');
      costUsd = (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k;
    } else {
      // Fallback: estimate based on model family
      costUsd = estimateCostByFamily(normalizedModelId, inputTokens, outputTokens);
      console.warn(`Model ${modelId} not in pricing table, using fallback estimate: $${costUsd.toFixed(6)}`);
    }
  } catch (err) {
    console.error('Failed to look up pricing:', err);
  }

  // Look up developer identity from IAM principal
  const iamPrincipal = detail.userIdentity?.arn ?? 'unknown';
  let developerEmail = 'unknown';
  let teamId = 'unknown';

  try {
    const identityResult = await dynamoClient.send(
      new GetItemCommand({
        TableName: IDENTITY_TABLE,
        Key: { iam_principal: { S: iamPrincipal } },
      }),
    );

    if (identityResult.Item) {
      developerEmail = identityResult.Item.developer_email?.S ?? 'unknown';
      teamId = identityResult.Item.team_id?.S ?? 'unknown';
    }
  } catch (err) {
    console.error('Failed to look up identity:', err);
  }

  // Emit prism.d1.token event to PRISM event bus
  const tokenEvent = {
    team_id: teamId,
    repo: 'unknown', // Cannot determine repo from CloudTrail alone
    timestamp: detail.eventTime,
    prism_level: 2,
    metric: {
      name: 'bedrock_token_usage',
      value: inputTokens + outputTokens,
      unit: 'count',
    },
    ai_context: {
      tool: detectToolFromUserAgent(detail.userAgent ?? ''),
      model: normalizedModelId,
      origin: 'ai-generated',
    },
    token: {
      model_id: modelId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      cost_usd: Math.round(costUsd * 1000000) / 1000000, // 6 decimal places
      iam_principal: iamPrincipal,
      developer_email: developerEmail,
    },
  };

  await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [
        {
          Source: 'prism.d1.velocity',
          DetailType: 'prism.d1.token',
          EventBusName: EVENT_BUS_NAME,
          Detail: JSON.stringify(tokenEvent),
        },
      ],
    }),
  );

  console.log(
    `Emitted token event: ${inputTokens} in / ${outputTokens} out, cost $${costUsd.toFixed(6)}, developer ${developerEmail}, tool ${detectToolFromUserAgent(detail.userAgent ?? '')}`,
  );
}

/**
 * Normalize model IDs to match the pricing table.
 * CloudTrail may log region-prefixed and versioned model IDs:
 *   us.anthropic.claude-sonnet-4-20250514-v1:0
 *   eu.anthropic.claude-sonnet-4-20250514-v2:0
 * The pricing table has base IDs:
 *   anthropic.claude-sonnet-4-20250514
 */
function normalizeModelId(modelId: string): string {
  let normalized = modelId;

  // Strip region prefix: us.anthropic.* → anthropic.*
  normalized = normalized.replace(/^(us|eu|ap|sa|me|af|ca)\./i, '');

  // Strip version suffix: -v1:0, -v2:1, etc.
  normalized = normalized.replace(/-v\d+:\d+$/, '');

  // Strip version suffix variant: :0, :1
  normalized = normalized.replace(/:\d+$/, '');

  return normalized;
}

/**
 * Fallback cost estimation when model ID is not in the pricing table.
 * Uses model family heuristics based on the model name.
 */
function estimateCostByFamily(modelId: string, inputTokens: number, outputTokens: number): number {
  const lower = modelId.toLowerCase();

  // Opus models
  if (lower.includes('opus')) {
    return (inputTokens / 1000) * 0.015 + (outputTokens / 1000) * 0.075;
  }
  // Sonnet models
  if (lower.includes('sonnet')) {
    return (inputTokens / 1000) * 0.003 + (outputTokens / 1000) * 0.015;
  }
  // Haiku models
  if (lower.includes('haiku')) {
    return (inputTokens / 1000) * 0.0008 + (outputTokens / 1000) * 0.004;
  }
  // Titan models
  if (lower.includes('titan')) {
    return (inputTokens / 1000) * 0.0005 + (outputTokens / 1000) * 0.0015;
  }
  // Nova models
  if (lower.includes('nova')) {
    return (inputTokens / 1000) * 0.001 + (outputTokens / 1000) * 0.004;
  }
  // Unknown — use Sonnet pricing as reasonable default
  return (inputTokens / 1000) * 0.003 + (outputTokens / 1000) * 0.015;
}

/**
 * Detect which AI tool made the Bedrock call based on the CloudTrail userAgent.
 */
function detectToolFromUserAgent(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (ua.includes('claude-code') || ua.includes('claudecode')) return 'claude-code';
  if (ua.includes('kiro')) return 'kiro';
  if (ua.includes('q-developer') || ua.includes('qdeveloper') || ua.includes('amazon-q')) return 'q-developer';
  if (ua.includes('strands') || ua.includes('strands-agents')) return 'strands-agent';
  if (ua.includes('cursor')) return 'cursor';
  if (ua.includes('copilot')) return 'copilot';
  if (ua.includes('boto3') || ua.includes('botocore')) return 'application-python';
  if (ua.includes('aws-sdk-js') || ua.includes('aws-sdk-node')) return 'application-node';
  if (ua.includes('aws-sdk-java')) return 'application-java';
  if (ua.includes('aws-sdk-go')) return 'application-go';
  if (ua.includes('aws-cli')) return 'aws-cli';

  return 'bedrock';
}
