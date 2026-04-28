import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { Construct } from 'constructs';

/**
 * Creates a DynamoDB table for Bedrock model pricing and seeds it
 * with current pricing data via a Custom Resource.
 */
export class ModelPricingConstruct extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'PricingTable', {
      tableName: 'prism-model-pricing',
      partitionKey: { name: 'model_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Seed pricing data via Custom Resource
    const seedFunction = new lambda.Function(this, 'SeedPricingFunction', {
      functionName: 'prism-d1-seed-pricing',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'seed-pricing.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '..', 'lambda'), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c',
            [
              'npm init -y > /dev/null 2>&1',
              'npm install --save @aws-sdk/client-dynamodb esbuild > /dev/null 2>&1',
              'npx esbuild seed-pricing.ts --bundle --platform=node --target=node20 --outfile=/asset-output/seed-pricing.js --external:@aws-sdk/*',
            ].join(' && '),
          ],
          local: {
            tryBundle(outputDir: string): boolean {
              try {
                const { execSync } = require('child_process');
                execSync(
                  `npx esbuild ${path.join(__dirname, '..', 'lambda', 'seed-pricing.ts')} --bundle --platform=node --target=node20 --outfile=${path.join(outputDir, 'seed-pricing.js')} --external:@aws-sdk/*`,
                  { stdio: 'pipe' },
                );
                return true;
              } catch {
                return false;
              }
            },
          },
        },
      }),
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        PRICING_TABLE: this.table.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    this.table.grantWriteData(seedFunction);

    const provider = new cr.Provider(this, 'SeedProvider', {
      onEventHandler: seedFunction,
    });

    new cdk.CustomResource(this, 'SeedPricingResource', {
      serviceToken: provider.serviceToken,
      properties: {
        // Change this value to trigger re-seeding on deploy
        version: '2026-04-27',
      },
    });
  }
}
