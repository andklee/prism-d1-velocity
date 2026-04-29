import * as cdk from 'aws-cdk-lib';
import * as securityagent from 'aws-cdk-lib/aws-securityagent';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface SecurityAgentProps {
  /**
   * Name for the agent space.
   */
  agentSpaceName: string;

  /**
   * Description of the agent space.
   */
  description?: string;

  /**
   * KMS key for encrypting Security Agent data.
   * If not provided, the PRISM KMS key should be passed in.
   */
  kmsKey?: kms.IKey;

  /**
   * Target domains to register for pen testing.
   * Each domain requires ownership verification.
   */
  targetDomains?: Array<{
    domainName: string;
    verificationMethod: 'DNS_TXT' | 'HTTP_ROUTE';
  }>;

  /**
   * VPC configuration for pen tests that need network access.
   */
  vpcConfig?: {
    securityGroupIds: string[];
    subnetIds: string[];
  };

  /**
   * Risk types to exclude from pen testing.
   * Example: ['DENIAL_OF_SERVICE']
   */
  excludeRiskTypes?: string[];

  /**
   * Whether to enable automatic code remediation.
   * @default 'DISABLED'
   */
  codeRemediationStrategy?: 'AUTOMATIC' | 'DISABLED';

  /**
   * Tags applied to all Security Agent resources.
   */
  tags?: Record<string, string>;
}

/**
 * CDK construct that provisions AWS Security Agent resources:
 * - AgentSpace: defines scope, integrations, and settings
 * - TargetDomains: registers domains for pen testing
 * - Service role with least-privilege permissions
 *
 * Pentests are triggered on-demand via API or the GitHub Actions workflow,
 * not provisioned statically via CloudFormation.
 */
export class SecurityAgentConstruct extends Construct {
  public readonly agentSpaceId: string;
  public readonly serviceRole: iam.Role;
  public readonly targetDomainIds: string[];

  constructor(scope: Construct, id: string, props: SecurityAgentProps) {
    super(scope, id);

    // Service role for Security Agent pen tests
    this.serviceRole = new iam.Role(this, 'SecurityAgentRole', {
      roleName: `prism-d1-security-agent-${props.agentSpaceName}`,
      assumedBy: new iam.ServicePrincipal('securityagent.amazonaws.com'),
      description: 'Service role for AWS Security Agent pen tests in PRISM D1',
    });

    // Grant Security Agent permissions to access target resources
    this.serviceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'securityagent:StartPentest',
          'securityagent:GetPentest',
          'securityagent:ListPentests',
          'securityagent:GetPentestFindings',
        ],
        resources: ['*'],
      }),
    );

    // Grant CloudWatch Logs access for pen test logging
    this.serviceRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'logs:CreateLogGroup',
          'logs:CreateLogStream',
          'logs:PutLogEvents',
        ],
        resources: ['arn:aws:logs:*:*:log-group:/prism/security-agent/*'],
      }),
    );

    // If VPC config provided, grant network interface permissions
    if (props.vpcConfig) {
      this.serviceRole.addToPolicy(
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'ec2:CreateNetworkInterface',
            'ec2:DescribeNetworkInterfaces',
            'ec2:DeleteNetworkInterface',
          ],
          resources: ['*'],
        }),
      );
    }

    // Agent Space
    const agentSpace = new securityagent.CfnAgentSpace(this, 'AgentSpace', {
      name: props.agentSpaceName,
      description: props.description ?? `PRISM D1 Security Agent space: ${props.agentSpaceName}`,
      ...(props.kmsKey && {
        kmsKeyId: props.kmsKey.keyArn,
      }),
      tags: [
        { key: 'prism:component', value: 'security-agent' },
        { key: 'prism:agent-space', value: props.agentSpaceName },
        ...Object.entries(props.tags ?? {}).map(([key, value]) => ({ key, value })),
      ],
    });

    this.agentSpaceId = agentSpace.attrAgentSpaceId;

    // Target Domains
    this.targetDomainIds = [];
    for (const domain of props.targetDomains ?? []) {
      const targetDomain = new securityagent.CfnTargetDomain(this, `Domain-${domain.domainName.replace(/\./g, '-')}`, {
        targetDomainName: domain.domainName,
        verificationMethod: domain.verificationMethod,
        tags: [
          { key: 'prism:component', value: 'security-agent' },
          { key: 'prism:domain', value: domain.domainName },
        ],
      });
      this.targetDomainIds.push(targetDomain.attrTargetDomainId);
    }

    // Associate target domains with agent space if any were created
    if (this.targetDomainIds.length > 0) {
      // Update the agent space with target domain IDs
      // Note: This requires the domains to be verified first
      (agentSpace as any).targetDomainIds = this.targetDomainIds;
    }

    // Log group for pen test results
    new logs.LogGroup(this, 'PentestLogGroup', {
      logGroupName: `/prism/security-agent/${props.agentSpaceName}`,
      retention: logs.RetentionDays.SIX_MONTHS,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Outputs
    new cdk.CfnOutput(this, 'AgentSpaceIdOutput', {
      value: this.agentSpaceId,
      description: `Security Agent space ID for ${props.agentSpaceName}`,
      exportName: `PrismD1SecurityAgentSpaceId`,
    });

    new cdk.CfnOutput(this, 'ServiceRoleArnOutput', {
      value: this.serviceRole.roleArn,
      description: 'Security Agent service role ARN',
      exportName: `PrismD1SecurityAgentRoleArn`,
    });

    if (this.targetDomainIds.length > 0) {
      new cdk.CfnOutput(this, 'TargetDomainIdsOutput', {
        value: this.targetDomainIds.join(','),
        description: 'Registered target domain IDs',
        exportName: `PrismD1SecurityAgentDomainIds`,
      });
    }
  }

  /**
   * Creates a CfnPentest resource for on-demand pen testing.
   * Call this method to define a pen test configuration that can be
   * triggered via the AWS CLI or API.
   */
  createPentestConfig(
    id: string,
    props: {
      title: string;
      endpoints: Array<{ url: string }>;
      serviceRole?: iam.IRole;
      vpcConfig?: { securityGroupIds: string[]; subnetIds: string[] };
      excludeRiskTypes?: string[];
      codeRemediationStrategy?: 'AUTOMATIC' | 'DISABLED';
    },
  ): securityagent.CfnPentest {
    return new securityagent.CfnPentest(this, id, {
      agentSpaceId: this.agentSpaceId,
      serviceRole: (props.serviceRole ?? this.serviceRole).roleArn,
      title: props.title,
      assets: {
        endpoints: props.endpoints.map((ep) => ({
          url: ep.url,
        })),
      },
      ...(props.excludeRiskTypes && { excludeRiskTypes: props.excludeRiskTypes }),
      ...(props.codeRemediationStrategy && { codeRemediationStrategy: props.codeRemediationStrategy }),
      ...(props.vpcConfig && {
        vpcConfig: {
          securityGroupIds: props.vpcConfig.securityGroupIds,
          subnetIds: props.vpcConfig.subnetIds,
        },
      }),
      logConfig: {
        cloudWatchLog: {
          logGroupName: `/prism/security-agent/${this.node.id}`,
        },
      },
    });
  }
}
