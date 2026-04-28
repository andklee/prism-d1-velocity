import {
  DynamoDBClient,
  QueryCommand,
} from '@aws-sdk/client-dynamodb';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';

const dynamoClient = new DynamoDBClient({});
const eventBridgeClient = new EventBridgeClient({});

const EVENTS_TABLE = process.env.EVENTS_TABLE!;
const EVENT_BUS_NAME = process.env.EVENT_BUS_NAME!;
const CORRELATION_WINDOW_MINUTES = parseInt(process.env.CORRELATION_WINDOW_MINUTES ?? '5', 10);

interface CommitEvent {
  source: string;
  'detail-type': string;
  detail: {
    team_id: string;
    repo: string;
    timestamp: string;
    ai_context?: {
      tool: string;
      model: string;
      origin: string;
    };
    metric?: {
      name: string;
      value: number;
      unit: string;
    };
  };
}

/**
 * Triggered by prism.d1.commit events.
 * Queries for prism.d1.token events within a time window before the commit,
 * sums tokens and cost, then emits a prism.d1.cost event.
 */
export async function handler(event: CommitEvent): Promise<void> {
  const detail = event.detail;
  console.log(`Correlating tokens for commit at ${detail.timestamp} in ${detail.repo}`);

  const commitTime = new Date(detail.timestamp);
  const windowStart = new Date(commitTime.getTime() - CORRELATION_WINDOW_MINUTES * 60 * 1000);

  // Query token events within the correlation window
  try {
    const result = await dynamoClient.send(
      new QueryCommand({
        TableName: EVENTS_TABLE,
        IndexName: 'by-detail-type',
        KeyConditionExpression: 'detail_type = :dt AND sk BETWEEN :start AND :end',
        ExpressionAttributeValues: {
          ':dt': { S: 'prism.d1.token' },
          ':start': { S: windowStart.toISOString() },
          ':end': { S: commitTime.toISOString() },
        },
      }),
    );

    if (!result.Items || result.Items.length === 0) {
      console.log('No token events found in correlation window');
      return;
    }

    // Aggregate token usage and cost
    let totalTokens = 0;
    let totalCostUsd = 0;
    const modelsUsed = new Set<string>();

    for (const item of result.Items) {
      const data = JSON.parse(item.data?.S ?? '{}');
      if (data.token) {
        totalTokens += data.token.total_tokens ?? 0;
        totalCostUsd += data.token.cost_usd ?? 0;
        if (data.token.model_id) {
          modelsUsed.add(data.token.model_id);
        }
      }
    }

    if (totalTokens === 0) {
      console.log('Token events found but no token data to correlate');
      return;
    }

    // Emit cost-per-commit event
    const costEvent = {
      team_id: detail.team_id,
      repo: detail.repo,
      timestamp: detail.timestamp,
      prism_level: 2,
      metric: {
        name: 'cost_per_commit',
        value: detail.metric?.value ?? 0, // lines changed from original commit
        unit: 'lines',
      },
      ai_context: detail.ai_context,
      cost: {
        commit_sha: 'unknown', // Not available from EventBridge event
        total_tokens: totalTokens,
        total_cost_usd: Math.round(totalCostUsd * 1000000) / 1000000,
        models_used: Array.from(modelsUsed),
        developer_email: 'unknown',
        correlation_window_minutes: CORRELATION_WINDOW_MINUTES,
      },
    };

    await eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [
          {
            Source: 'prism.d1.velocity',
            DetailType: 'prism.d1.cost',
            EventBusName: EVENT_BUS_NAME,
            Detail: JSON.stringify(costEvent),
          },
        ],
      }),
    );

    console.log(
      `Emitted cost event: ${totalTokens} tokens, $${totalCostUsd.toFixed(6)}, ${modelsUsed.size} models`,
    );
  } catch (err) {
    console.error('Failed to correlate tokens to commit:', err);
  }
}
