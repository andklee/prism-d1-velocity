import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamoClient = new DynamoDBClient({});
const PRICING_TABLE = process.env.PRICING_TABLE!;

/**
 * Bedrock model pricing data (per 1K tokens, USD).
 * Updated as of 2026-04-27. Adjust values when pricing changes.
 */
/**
 * Base pricing data. The seeder generates regional variants automatically
 * (us.anthropic.*, eu.anthropic.*) so both exact and cross-region inference
 * model IDs match during lookup.
 */
const BASE_PRICING = [
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
    model_id: 'anthropic.claude-sonnet-4-6-20250514',
    input_cost_per_1k: 0.003,
    output_cost_per_1k: 0.015,
    provider: 'Anthropic',
    model_family: 'Claude 4.6',
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
  {
    model_id: 'amazon.nova-pro-v1:0',
    input_cost_per_1k: 0.0008,
    output_cost_per_1k: 0.0032,
    provider: 'Amazon',
    model_family: 'Nova',
  },
  {
    model_id: 'amazon.nova-lite-v1:0',
    input_cost_per_1k: 0.00006,
    output_cost_per_1k: 0.00024,
    provider: 'Amazon',
    model_family: 'Nova',
  },
];

// Generate regional variants: us.anthropic.*, eu.anthropic.*
const REGION_PREFIXES = ['us', 'eu', 'ap'];
const PRICING_DATA: typeof BASE_PRICING = [];

for (const entry of BASE_PRICING) {
  // Add base model ID
  PRICING_DATA.push(entry);

  // Add regional variants for Anthropic models (cross-region inference)
  if (entry.model_id.startsWith('anthropic.')) {
    for (const prefix of REGION_PREFIXES) {
      PRICING_DATA.push({
        ...entry,
        model_id: `${prefix}.${entry.model_id}`,
      });
    }
  }
}

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
