import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

/**
 * Creates a DynamoDB table mapping IAM principals to developer identities.
 * Used by the token processor to attribute Bedrock API costs to individual developers.
 */
export class IdentityMappingConstruct extends Construct {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.table = new dynamodb.Table(this, 'IdentityTable', {
      tableName: 'prism-identity-mapping',
      partitionKey: { name: 'iam_principal', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI for querying all developers on a team
    this.table.addGlobalSecondaryIndex({
      indexName: 'by-team',
      partitionKey: { name: 'team_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'developer_email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    new cdk.CfnOutput(this, 'IdentityTableName', {
      value: this.table.tableName,
      exportName: 'PrismD1IdentityTable',
    });
  }
}
