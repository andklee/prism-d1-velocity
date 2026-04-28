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

  // Look up model pricing
  let costUsd = 0;
  try {
    const pricingResult = await dynamoClient.send(
      new GetItemCommand({
        TableName: PRICING_TABLE,
        Key: { model_id: { S: modelId } },
      }),
    );

    if (pricingResult.Item) {
      const inputCostPer1k = parseFloat(pricingResult.Item.input_cost_per_1k?.N ?? '0');
      const outputCostPer1k = parseFloat(pricingResult.Item.output_cost_per_1k?.N ?? '0');
      costUsd = (inputTokens / 1000) * inputCostPer1k + (outputTokens / 1000) * outputCostPer1k;
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
      tool: 'bedrock',
      model: modelId,
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
    `Emitted token event: ${inputTokens} in / ${outputTokens} out, cost $${costUsd.toFixed(6)}, developer ${developerEmail}`,
  );
}
