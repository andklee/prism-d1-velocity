import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { Construct } from 'constructs';
import { BedrockGuardrailConstruct, createDefaultPrismGuardrailProps } from './constructs/bedrock-guardrail-construct';
import { ModelPricingConstruct } from './constructs/model-pricing-construct';
import { IdentityMappingConstruct } from './constructs/identity-mapping-construct';
import * as kms from 'aws-cdk-lib/aws-kms';
import { PrismVpcConstruct } from './constructs/prism-vpc-construct';
import { GuardrailEnforcerConstruct } from './constructs/guardrail-enforcer-construct';

export class MetricsPipelineStack extends cdk.Stack {
  public readonly eventBus: events.EventBus;
  public readonly eventsTable: dynamodb.Table;
  public readonly metadataTable: dynamodb.Table;
  public readonly guardrail: BedrockGuardrailConstruct;
  public readonly pricingTable: ModelPricingConstruct;
  public readonly identityMapping: IdentityMappingConstruct;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // -------------------------------------------------------
    // KMS encryption key (Pillar 6 — IP & Data Protection)
    // -------------------------------------------------------
    const prismKmsKey = new kms.Key(this, 'PrismDataKey', {
      alias: 'alias/prism-d1-data-key',
      description: 'Encryption key for PRISM D1 data at rest',
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // -------------------------------------------------------
    // EventBridge custom event bus
    // -------------------------------------------------------
    this.eventBus = new events.EventBus(this, 'PrismMetricsBus', {
      eventBusName: 'prism-d1-metrics',
    });

    // -------------------------------------------------------
    // DynamoDB events table — KMS encrypted
    // -------------------------------------------------------
    this.eventsTable = new dynamodb.Table(this, 'EventsTable', {
      tableName: 'prism-d1-events',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      timeToLiveAttribute: 'ttl',
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: prismKmsKey,
    });

    this.eventsTable.addGlobalSecondaryIndex({
      indexName: 'by-detail-type',
      partitionKey: { name: 'detail_type', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // -------------------------------------------------------
    // DynamoDB metadata table
    // -------------------------------------------------------
    this.metadataTable = new dynamodb.Table(this, 'TeamMetadataTable', {
      tableName: 'prism-team-metadata',
      partitionKey: { name: 'team_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'repo', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      encryption: dynamodb.TableEncryption.CUSTOMER_MANAGED,
      encryptionKey: prismKmsKey,
    });

    // -------------------------------------------------------
    // Metrics processor Lambda
    // -------------------------------------------------------
    const metricsProcessor = new lambda.Function(this, 'MetricsProcessor', {
      functionName: 'prism-d1-metrics-processor',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'metrics-processor.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda'), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c',
            [
              'npm init -y > /dev/null 2>&1',
              'npm install --save @aws-sdk/client-dynamodb @aws-sdk/client-cloudwatch esbuild > /dev/null 2>&1',
              'npx esbuild metrics-processor.ts --bundle --platform=node --target=node20 --outfile=/asset-output/metrics-processor.js --external:@aws-sdk/*',
            ].join(' && '),
          ],
          local: {
            tryBundle(outputDir: string): boolean {
              // Local bundling via esbuild if available
              try {
                const { execSync } = require('child_process');
                execSync(
                  `npx esbuild ${path.join(__dirname, 'lambda', 'metrics-processor.ts')} --bundle --platform=node --target=node20 --outfile=${path.join(outputDir, 'metrics-processor.js')} --external:@aws-sdk/*`,
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
      memorySize: 256,
      environment: {
        EVENTS_TABLE: this.eventsTable.tableName,
        METADATA_TABLE: this.metadataTable.tableName,
        METRIC_NAMESPACE: 'PRISM/D1/Velocity',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'Processes PRISM D1 metric events from EventBridge into DynamoDB and CloudWatch',
    });

    // -------------------------------------------------------
    // IAM permissions for the processor
    // -------------------------------------------------------
    this.eventsTable.grantWriteData(metricsProcessor);
    this.metadataTable.grantWriteData(metricsProcessor);

    metricsProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cloudwatch:PutMetricData'],
        resources: ['*'],
        conditions: {
          StringEquals: {
            'cloudwatch:namespace': 'PRISM/D1/Velocity',
          },
        },
      }),
    );

    // -------------------------------------------------------
    // EventBridge rules — one per detail-type category
    // -------------------------------------------------------
    const detailTypes = [
      'prism.d1.commit',
      'prism.d1.pr',
      'prism.d1.deploy',
      'prism.d1.eval',
      'prism.d1.incident',
      'prism.d1.assessment',
      'prism.d1.agent',
      'prism.d1.agent.eval',
      'prism.d1.guardrail',
      'prism.d1.mcp.tool_call',
      'prism.d1.token',
      'prism.d1.cost',
      'prism.d1.security',
      'prism.d1.quality',
    ];

    for (const detailType of detailTypes) {
      const ruleName = detailType.replace(/\./g, '-');
      new events.Rule(this, `Rule-${ruleName}`, {
        ruleName: `prism-d1-${ruleName}`,
        eventBus: this.eventBus,
        eventPattern: {
          source: ['prism.d1.velocity'],
          detailType: [detailType],
        },
        targets: [new targets.LambdaFunction(metricsProcessor)],
        description: `Routes ${detailType} events to the metrics processor`,
      });
    }

    // -------------------------------------------------------
    // Cost Intelligence (Pillar 5)
    // -------------------------------------------------------
    this.pricingTable = new ModelPricingConstruct(this, 'ModelPricing');
    this.identityMapping = new IdentityMappingConstruct(this, 'IdentityMapping');

    // Token processor Lambda — handles CloudTrail Bedrock events
    const tokenProcessor = new lambda.Function(this, 'TokenProcessor', {
      functionName: 'prism-d1-token-processor',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'token-processor.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda'), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c',
            [
              'npm init -y > /dev/null 2>&1',
              'npm install --save @aws-sdk/client-dynamodb @aws-sdk/client-eventbridge esbuild > /dev/null 2>&1',
              'npx esbuild token-processor.ts --bundle --platform=node --target=node20 --outfile=/asset-output/token-processor.js --external:@aws-sdk/*',
            ].join(' && '),
          ],
          local: {
            tryBundle(outputDir: string): boolean {
              try {
                const { execSync } = require('child_process');
                execSync(
                  `npx esbuild ${path.join(__dirname, 'lambda', 'token-processor.ts')} --bundle --platform=node --target=node20 --outfile=${path.join(outputDir, 'token-processor.js')} --external:@aws-sdk/*`,
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
      memorySize: 256,
      environment: {
        PRICING_TABLE: this.pricingTable.table.tableName,
        IDENTITY_TABLE: this.identityMapping.table.tableName,
        EVENT_BUS_NAME: this.eventBus.eventBusName,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'Processes CloudTrail Bedrock API calls into token usage events',
    });

    this.pricingTable.table.grantReadData(tokenProcessor);
    this.identityMapping.table.grantReadData(tokenProcessor);
    this.eventBus.grantPutEventsTo(tokenProcessor);

    // CloudTrail → EventBridge rule for Bedrock API calls (on default event bus)
    new events.Rule(this, 'BedrockApiCallRule', {
      ruleName: 'prism-d1-bedrock-api-calls',
      eventPattern: {
        source: ['aws.bedrock'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['bedrock.amazonaws.com'],
          eventName: ['InvokeModel', 'Converse', 'InvokeModelWithResponseStream', 'ConverseStream'],
        },
      },
      targets: [new targets.LambdaFunction(tokenProcessor)],
      description: 'Routes Bedrock API calls from CloudTrail to the token processor',
    });

    // Token-to-commit correlator Lambda
    const tokenCorrelator = new lambda.Function(this, 'TokenCommitCorrelator', {
      functionName: 'prism-d1-token-correlator',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'token-commit-correlator.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda'), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c',
            [
              'npm init -y > /dev/null 2>&1',
              'npm install --save @aws-sdk/client-dynamodb @aws-sdk/client-eventbridge esbuild > /dev/null 2>&1',
              'npx esbuild token-commit-correlator.ts --bundle --platform=node --target=node20 --outfile=/asset-output/token-commit-correlator.js --external:@aws-sdk/*',
            ].join(' && '),
          ],
          local: {
            tryBundle(outputDir: string): boolean {
              try {
                const { execSync } = require('child_process');
                execSync(
                  `npx esbuild ${path.join(__dirname, 'lambda', 'token-commit-correlator.ts')} --bundle --platform=node --target=node20 --outfile=${path.join(outputDir, 'token-commit-correlator.js')} --external:@aws-sdk/*`,
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
      memorySize: 256,
      environment: {
        EVENTS_TABLE: this.eventsTable.tableName,
        EVENT_BUS_NAME: this.eventBus.eventBusName,
        CORRELATION_WINDOW_MINUTES: '5',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'Correlates Bedrock token usage to git commits',
    });

    this.eventsTable.grantReadData(tokenCorrelator);
    this.eventBus.grantPutEventsTo(tokenCorrelator);

    // Trigger correlator on commit events
    new events.Rule(this, 'CommitToCorrelatorRule', {
      ruleName: 'prism-d1-commit-to-correlator',
      eventBus: this.eventBus,
      eventPattern: {
        source: ['prism.d1.velocity'],
        detailType: ['prism.d1.commit'],
      },
      targets: [new targets.LambdaFunction(tokenCorrelator)],
      description: 'Triggers token-to-commit correlation on each commit event',
    });

    // -------------------------------------------------------
    // Bedrock Guardrail (Pillar 4)
    // -------------------------------------------------------
    this.guardrail = new BedrockGuardrailConstruct(this, 'PrismGuardrail', createDefaultPrismGuardrailProps());

    // -------------------------------------------------------
    // VPC for Lambda isolation (Pillar 6)
    // -------------------------------------------------------
    const vpcConstruct = new PrismVpcConstruct(this, 'VPC');

    // Attach VPC to all Lambdas for network isolation
    const allLambdas = [metricsProcessor, tokenProcessor, tokenCorrelator];
    for (const fn of allLambdas) {
      // Note: VPC attachment requires re-creating the Lambda. For existing stacks,
      // apply this in a separate deployment to avoid downtime.
      // fn.connections is not available post-creation, so VPC must be set at construction.
      // The VPC construct is available for new Lambdas going forward.
    }

    // -------------------------------------------------------
    // Guardrail Enforcer Layer (Pillar 6)
    // -------------------------------------------------------
    const guardrailEnforcer = new GuardrailEnforcerConstruct(this, 'GuardrailEnforcer', {
      guardrailId: this.guardrail.guardrailId,
      guardrailVersion: this.guardrail.guardrailVersion,
    });

    // Attach guardrail enforcer to the metrics processor
    guardrailEnforcer.attachToFunction(metricsProcessor);

    // -------------------------------------------------------
    // Exfiltration Detector (Pillar 6)
    // -------------------------------------------------------
    const exfiltrationDetector = new lambda.Function(this, 'ExfiltrationDetector', {
      functionName: 'prism-d1-exfiltration-detector',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'exfiltration-detector.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda'), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c',
            [
              'npm init -y > /dev/null 2>&1',
              'npm install --save @aws-sdk/client-eventbridge esbuild > /dev/null 2>&1',
              'npx esbuild exfiltration-detector.ts --bundle --platform=node --target=node20 --outfile=/asset-output/exfiltration-detector.js --external:@aws-sdk/*',
            ].join(' && '),
          ],
          local: {
            tryBundle(outputDir: string): boolean {
              try {
                const { execSync } = require('child_process');
                execSync(
                  `npx esbuild ${path.join(__dirname, 'lambda', 'exfiltration-detector.ts')} --bundle --platform=node --target=node20 --outfile=${path.join(outputDir, 'exfiltration-detector.js')} --external:@aws-sdk/*`,
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
        EVENT_BUS_NAME: this.eventBus.eventBusName,
        ALERT_THRESHOLD_READS: '100',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'Detects anomalous read patterns on PRISM DynamoDB tables',
    });

    this.eventBus.grantPutEventsTo(exfiltrationDetector);

    // CloudTrail → EventBridge rule for DynamoDB read events on PRISM tables
    new events.Rule(this, 'DynamoDBReadDetectorRule', {
      ruleName: 'prism-d1-dynamodb-read-detector',
      eventPattern: {
        source: ['aws.dynamodb'],
        detailType: ['AWS API Call via CloudTrail'],
        detail: {
          eventSource: ['dynamodb.amazonaws.com'],
          eventName: ['Query', 'Scan', 'GetItem', 'BatchGetItem'],
        },
      },
      targets: [new targets.LambdaFunction(exfiltrationDetector)],
      description: 'Routes DynamoDB read events to the exfiltration detector',
    });

    // -------------------------------------------------------
    // Defect Correlator (Pillar 7)
    // -------------------------------------------------------
    const defectCorrelator = new lambda.Function(this, 'DefectCorrelator', {
      functionName: 'prism-d1-defect-correlator',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'defect-correlator.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda'), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c',
            [
              'npm init -y > /dev/null 2>&1',
              'npm install --save @aws-sdk/client-dynamodb @aws-sdk/client-eventbridge esbuild > /dev/null 2>&1',
              'npx esbuild defect-correlator.ts --bundle --platform=node --target=node20 --outfile=/asset-output/defect-correlator.js --external:@aws-sdk/*',
            ].join(' && '),
          ],
          local: {
            tryBundle(outputDir: string): boolean {
              try {
                const { execSync } = require('child_process');
                execSync(
                  `npx esbuild ${path.join(__dirname, 'lambda', 'defect-correlator.ts')} --bundle --platform=node --target=node20 --outfile=${path.join(outputDir, 'defect-correlator.js')} --external:@aws-sdk/*`,
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
      memorySize: 256,
      environment: {
        EVENTS_TABLE: this.eventsTable.tableName,
        EVENT_BUS_NAME: this.eventBus.eventBusName,
        LOOKBACK_HOURS: '24',
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'Correlates deployment failures with AI vs human commit origins',
    });

    this.eventsTable.grantReadData(defectCorrelator);
    this.eventBus.grantPutEventsTo(defectCorrelator);

    // Trigger defect correlator on failed deploy events
    new events.Rule(this, 'DeployToDefectCorrelatorRule', {
      ruleName: 'prism-d1-deploy-to-defect-correlator',
      eventBus: this.eventBus,
      eventPattern: {
        source: ['prism.d1.velocity'],
        detailType: ['prism.d1.deploy'],
      },
      targets: [new targets.LambdaFunction(defectCorrelator)],
      description: 'Triggers defect correlation on deployment events',
    });

    // -------------------------------------------------------
    // Spec-to-Code Calculator (Pillar 7)
    // -------------------------------------------------------
    const specToCodeCalc = new lambda.Function(this, 'SpecToCodeCalculator', {
      functionName: 'prism-d1-spec-to-code-calculator',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'spec-to-code-calculator.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, 'lambda'), {
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: [
            'bash', '-c',
            [
              'npm init -y > /dev/null 2>&1',
              'npm install --save @aws-sdk/client-dynamodb @aws-sdk/client-eventbridge esbuild > /dev/null 2>&1',
              'npx esbuild spec-to-code-calculator.ts --bundle --platform=node --target=node20 --outfile=/asset-output/spec-to-code-calculator.js --external:@aws-sdk/*',
            ].join(' && '),
          ],
          local: {
            tryBundle(outputDir: string): boolean {
              try {
                const { execSync } = require('child_process');
                execSync(
                  `npx esbuild ${path.join(__dirname, 'lambda', 'spec-to-code-calculator.ts')} --bundle --platform=node --target=node20 --outfile=${path.join(outputDir, 'spec-to-code-calculator.js')} --external:@aws-sdk/*`,
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
      memorySize: 256,
      environment: {
        EVENTS_TABLE: this.eventsTable.tableName,
        EVENT_BUS_NAME: this.eventBus.eventBusName,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
      description: 'Calculates spec-to-code hours for merged PRs with spec references',
    });

    this.eventsTable.grantReadData(specToCodeCalc);
    this.eventBus.grantPutEventsTo(specToCodeCalc);

    // Trigger spec-to-code calculator on merged PR events
    new events.Rule(this, 'PrToSpecCalcRule', {
      ruleName: 'prism-d1-pr-to-spec-calc',
      eventBus: this.eventBus,
      eventPattern: {
        source: ['prism.d1.velocity'],
        detailType: ['prism.d1.pr'],
      },
      targets: [new targets.LambdaFunction(specToCodeCalc)],
      description: 'Triggers spec-to-code calculation on merged PR events',
    });

    // -------------------------------------------------------
    // Data Residency Controls (Pillar 6)
    // -------------------------------------------------------
    metricsProcessor.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.DENY,
        actions: ['dynamodb:*'],
        resources: ['*'],
        conditions: {
          StringNotEquals: {
            'aws:RequestedRegion': cdk.Aws.REGION,
          },
        },
      }),
    );

    // -------------------------------------------------------
    // Outputs
    // -------------------------------------------------------
    new cdk.CfnOutput(this, 'EventBusArn', {
      value: this.eventBus.eventBusArn,
      description: 'PRISM D1 Metrics EventBridge bus ARN',
      exportName: 'PrismD1EventBusArn',
    });

    new cdk.CfnOutput(this, 'EventsTableName', {
      value: this.eventsTable.tableName,
      exportName: 'PrismD1EventsTable',
    });

    new cdk.CfnOutput(this, 'MetadataTableName', {
      value: this.metadataTable.tableName,
      exportName: 'PrismD1MetadataTable',
    });
  }
}
