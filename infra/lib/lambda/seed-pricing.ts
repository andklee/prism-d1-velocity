import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({});
const PRICING_TABLE = process.env.PRICING_TABLE!;

/**
 * Bedrock model pricing data (per 1K tokens, USD).
 * Updated as of 2026-04-27. Adjust values when pricing changes.
 */
const PRICING_DATA = [
  {
    model_id: 'anthropic.claude-opus-4-20250514',
    input_cost_per_1k: 0.015,
    output_cost_per_1k: 0.075,
    provider: 'Anthropic',
    model_family: 'Claude 4',
  },
  {
    model_id: 'anthropic.claude-sonnet-4-20250514',
    input_cost_per_1k: 0.003,
    output_cost_per_1k: 0.015,
    provider: 'Anthropic',
    model_family: 'Claude 4',
  },
  {
    model_id: 'anthropic.claude-haiku-4-5-20251001',
    input_cost_per_1k: 0.0008,
    output_cost_per_1k: 0.004,
    provider: 'Anthropic',
    model_family: 'Claude 4.5',
  },
  {
    model_id: 'anthropic.claude-haiku-3-20250307',
    input_cost_per_1k: 0.00025,
    output_cost_per_1k: 0.00125,
    provider: 'Anthropic',
    model_family: 'Claude 3',
  },
  {
    model_id: 'amazon.titan-text-express-v1',
    input_cost_per_1k: 0.0002,
    output_cost_per_1k: 0.0006,
    provider: 'Amazon',
    model_family: 'Titan',
  },
  {
    model_id: 'amazon.titan-text-premier-v1',
    input_cost_per_1k: 0.0005,
    output_cost_per_1k: 0.0015,
    provider: 'Amazon',
    model_family: 'Titan',
  },
];

export async function handler(event: any): Promise<{ Status: string }> {
  console.log('Seeding pricing data...', JSON.stringify(event));

  // Only seed on Create and Update events
  if (event.RequestType === 'Delete') {
    return { Status: 'SUCCESS' };
  }

  for (const pricing of PRICING_DATA) {
    await dynamoClient.send(
      new PutItemCommand({
        TableName: PRICING_TABLE,
        Item: {
          model_id: { S: pricing.model_id },
          input_cost_per_1k: { N: pricing.input_cost_per_1k.toString() },
          output_cost_per_1k: { N: pricing.output_cost_per_1k.toString() },
          provider: { S: pricing.provider },
          model_family: { S: pricing.model_family },
          effective_date: { S: new Date().toISOString() },
        },
      }),
    );
    console.log(`Seeded pricing for ${pricing.model_id}`);
  }

  return { Status: 'SUCCESS' };
}
