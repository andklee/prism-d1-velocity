import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { Construct } from 'constructs';
import { NagSuppressions } from 'cdk-nag';

const METRIC_NAMESPACE = 'PRISM/D1/Velocity';
const DEFAULT_PERIOD = cdk.Duration.hours(1);

export class DashboardStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // cdk-nag: CloudWatch alarms in this stack are for observability dashboards.
    // SNS alarm actions are configured by operators post-deployment.
    NagSuppressions.addStackSuppressions(this, [
      {
        id: 'AwsSolutions-SNS2',
        reason: 'Alarm notification topics are configured post-deployment by operators.',
      },
      {
        id: 'AwsSolutions-SNS3',
        reason: 'Alarm notification topics are configured post-deployment by operators.',
      },
    ]);

    // =======================================================
    // Dashboard 1: Team Velocity
    // =======================================================
    const teamDashboard = new cloudwatch.Dashboard(this, 'TeamVelocityDashboard', {
      dashboardName: 'PRISM-D1-Team-Velocity',
      defaultInterval: cdk.Duration.days(7),
    });

    // --- AI Acceptance Rate (time series) ---
    const aiAcceptanceMetric = new cloudwatch.Metric({
      namespace: METRIC_NAMESPACE,
      metricName: 'AIAcceptanceRate',
      statistic: 'Average',
      period: DEFAULT_PERIOD,
      label: 'AI Acceptance Rate (%)',
    });

    teamDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# PRISM D1 - Team Velocity Dashboard\nReal-time AI-enhanced DORA metrics for engineering teams.',
        width: 24,
        height: 1,
      }),
    );

    teamDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'AI Acceptance Rate',
        left: [aiAcceptanceMetric],
        width: 12,
        height: 6,
        leftYAxis: { min: 0, max: 100, label: 'Percent' },
        statistic: 'Average',
        period: DEFAULT_PERIOD,
      }),
      new cloudwatch.GraphWidget({
        title: 'Deployment Frequency',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'DeploymentFrequency',
            statistic: 'Sum',
            period: cdk.Duration.days(1),
            label: 'Deploys / Day',
          }),
        ],
        width: 12,
        height: 6,
        view: cloudwatch.GraphWidgetView.BAR,
        leftYAxis: { min: 0, label: 'Deployments' },
      }),
    );

    teamDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lead Time for Changes',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'LeadTimeForChanges',
            statistic: 'Average',
            period: DEFAULT_PERIOD,
            label: 'Lead Time (seconds)',
          }),
        ],
        width: 8,
        height: 6,
        leftYAxis: { min: 0, label: 'Seconds' },
      }),
      new cloudwatch.GaugeWidget({
        title: 'Eval Gate Pass Rate',
        metrics: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'EvalGatePassRate',
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'Eval Pass Rate (%)',
          }),
        ],
        width: 8,
        height: 6,
        leftYAxis: { min: 0, max: 100 },
      }),
      new cloudwatch.GraphWidget({
        title: 'AI Test Coverage Delta',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'AITestCoverageDelta',
            statistic: 'Average',
            period: DEFAULT_PERIOD,
            label: 'Coverage Delta (%)',
          }),
        ],
        width: 8,
        height: 6,
        leftYAxis: { label: 'Percent' },
      }),
    );

    // --- Additional team metrics row ---
    teamDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Change Failure Rate',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'ChangeFailureRate',
            statistic: 'Average',
            period: DEFAULT_PERIOD,
            label: 'Change Failure Rate (%)',
          }),
        ],
        width: 8,
        height: 6,
        leftYAxis: { min: 0, max: 100, label: 'Percent' },
      }),
      new cloudwatch.GraphWidget({
        title: 'Mean Time to Recovery',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'MTTR',
            statistic: 'Average',
            period: DEFAULT_PERIOD,
            label: 'MTTR (seconds)',
          }),
        ],
        width: 8,
        height: 6,
        leftYAxis: { min: 0, label: 'Seconds' },
      }),
      new cloudwatch.GraphWidget({
        title: 'AI to Merge Ratio',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'AIToMergeRatio',
            statistic: 'Average',
            period: DEFAULT_PERIOD,
            label: 'AI-to-Merge Ratio (%)',
          }),
        ],
        width: 8,
        height: 6,
        leftYAxis: { min: 0, max: 100, label: 'Percent' },
      }),
    );

    // --- Agent Metrics Row ---
    const teamId = 'ALL';
    const repository = 'ALL';

    teamDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '### AI Token Usage & Cost',
        width: 24,
        height: 1,
      }),
    );

    teamDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'AI Input Tokens per PR',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'AIInputTokens',
            statistic: 'Sum',
            period: DEFAULT_PERIOD,
            label: 'Input Tokens',
          }),
        ],
        width: 8,
        height: 6,
        leftYAxis: { min: 0, label: 'Tokens' },
      }),
      new cloudwatch.GraphWidget({
        title: 'AI Output Tokens per PR',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'AIOutputTokens',
            statistic: 'Sum',
            period: DEFAULT_PERIOD,
            label: 'Output Tokens',
          }),
        ],
        width: 8,
        height: 6,
        leftYAxis: { min: 0, label: 'Tokens' },
      }),
      new cloudwatch.GraphWidget({
        title: 'AI Cost per PR (USD)',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'AICostUSD',
            statistic: 'Sum',
            period: DEFAULT_PERIOD,
            label: 'Cost (USD)',
          }),
        ],
        width: 8,
        height: 6,
        leftYAxis: { min: 0, label: 'USD' },
      }),
    );

    teamDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '### Agent Operations',
        width: 24,
        height: 1,
      }),
    );

    teamDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Agent Invocations',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'AgentInvocationCount',
            dimensionsMap: { TeamId: teamId, Repository: repository },
            statistic: 'Sum',
            period: DEFAULT_PERIOD,
            label: 'Invocations',
          }),
        ],
        width: 8,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Agent Success Rate',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'AgentSuccessRate',
            dimensionsMap: { TeamId: teamId, Repository: repository },
            statistic: 'Average',
            period: DEFAULT_PERIOD,
            label: 'Success Rate (%)',
          }),
        ],
        width: 8,
        height: 6,
        leftYAxis: { min: 0, max: 100, label: 'Percent' },
      }),
      new cloudwatch.GraphWidget({
        title: 'Agent Avg Duration',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'AgentDurationMs',
            dimensionsMap: { TeamId: teamId, Repository: repository },
            statistic: 'Average',
            period: DEFAULT_PERIOD,
            label: 'Duration (ms)',
          }),
        ],
        width: 8,
        height: 6,
      }),
    );

    // =======================================================
    // Dashboard 2: Executive Readout
    // =======================================================
    const execDashboard = new cloudwatch.Dashboard(this, 'ExecutiveReadoutDashboard', {
      dashboardName: 'PRISM-D1-Executive-Readout',
      defaultInterval: cdk.Duration.days(30),
    });

    execDashboard.addWidgets(
      new cloudwatch.TextWidget({
        markdown: '# PRISM D1 - Executive Readout\nLeadership view of AI-assisted engineering velocity and DORA performance.',
        width: 24,
        height: 1,
      }),
    );

    // --- PRISM Level Progress + Enhanced DORA Summary row ---
    execDashboard.addWidgets(
      new cloudwatch.SingleValueWidget({
        title: 'PRISM Level Progress',
        metrics: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'PRISMLevel',
            statistic: 'Maximum',
            period: cdk.Duration.days(1),
            label: 'Current PRISM Level',
          }),
        ],
        width: 6,
        height: 4,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'Enhanced DORA Summary',
        metrics: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'DeploymentFrequency',
            statistic: 'Sum',
            period: cdk.Duration.days(7),
            label: 'Deploy Freq (7d)',
          }),
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'LeadTimeForChanges',
            statistic: 'Average',
            period: cdk.Duration.days(7),
            label: 'Avg Lead Time (s)',
          }),
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'ChangeFailureRate',
            statistic: 'Average',
            period: cdk.Duration.days(7),
            label: 'Change Fail Rate (%)',
          }),
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'MTTR',
            statistic: 'Average',
            period: cdk.Duration.days(7),
            label: 'Avg MTTR (s)',
          }),
        ],
        width: 12,
        height: 4,
      }),
      new cloudwatch.SingleValueWidget({
        title: 'AI Cost & Cycle Time',
        metrics: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'AICostUSD',
            statistic: 'Sum',
            period: cdk.Duration.days(7),
            label: 'Total AI Cost (7d, USD)',
          }),
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'SpecToCodeHours',
            statistic: 'Average',
            period: cdk.Duration.days(7),
            label: 'Avg Spec-to-Code (hrs)',
          }),
        ],
        width: 6,
        height: 4,
      }),
    );

    // --- AI Contribution Trend + Feature Cycle Time Trend ---
    execDashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'AI Contribution Trend',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'AIAcceptanceRate',
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'AI Acceptance Rate (%)',
          }),
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'AIToMergeRatio',
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'AI-to-Merge Ratio (%)',
          }),
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'AITestCoverageDelta',
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'AI Test Coverage Delta (%)',
          }),
        ],
        width: 12,
        height: 6,
        leftYAxis: { min: 0, max: 100, label: 'Percent' },
      }),
      new cloudwatch.GraphWidget({
        title: 'Feature Cycle Time Trend',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'SpecToCodeHours',
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'Spec-to-Code (hrs)',
          }),
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'LeadTimeForChanges',
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'Lead Time (seconds)',
          }),
        ],
        width: 12,
        height: 6,
      }),
    );

    // --- Eval gate, quality, and cost trend row ---
    execDashboard.addWidgets(
      new cloudwatch.GaugeWidget({
        title: 'Eval Gate Pass Rate',
        metrics: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'EvalGatePassRate',
            statistic: 'Average',
            period: cdk.Duration.days(7),
            label: 'Eval Pass Rate (%)',
          }),
        ],
        width: 6,
        height: 6,
        leftYAxis: { min: 0, max: 100 },
      }),
      new cloudwatch.GraphWidget({
        title: 'Post-Merge Defect Rate',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'PostMergeDefectRate',
            statistic: 'Average',
            period: cdk.Duration.days(1),
            label: 'Defect Rate (%)',
          }),
        ],
        width: 6,
        height: 6,
        leftYAxis: { min: 0, label: 'Percent' },
      }),
      new cloudwatch.GraphWidget({
        title: 'AI Cost Trend (Weekly)',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'AICostUSD',
            statistic: 'Sum',
            period: cdk.Duration.days(7),
            label: 'Total Cost (USD)',
          }),
        ],
        width: 6,
        height: 6,
        leftYAxis: { min: 0, label: 'USD' },
      }),
      new cloudwatch.GraphWidget({
        title: 'Deployment Frequency (Weekly)',
        left: [
          new cloudwatch.Metric({
            namespace: METRIC_NAMESPACE,
            metricName: 'DeploymentFrequency',
            statistic: 'Sum',
            period: cdk.Duration.days(7),
            label: 'Deploys / Week',
          }),
        ],
        width: 6,
        height: 6,
        view: cloudwatch.GraphWidgetView.BAR,
        leftYAxis: { min: 0, label: 'Deployments' },
      }),
    );

    // =======================================================
    // CloudWatch Alarms
    // =======================================================

    // Alarm: AI acceptance rate dropping below 20%
    new cloudwatch.Alarm(this, 'AiAcceptanceRateLowAlarm', {
      alarmName: 'PRISM-D1-AIAcceptanceRate-Low',
      alarmDescription: 'AI acceptance rate has dropped below 20%, indicating potential issues with AI-generated code quality or review friction.',
      metric: new cloudwatch.Metric({
        namespace: METRIC_NAMESPACE,
        metricName: 'AIAcceptanceRate',
        statistic: 'Average',
        period: cdk.Duration.hours(6),
      }),
      threshold: 20,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm: Eval gate pass rate dropping below 70%
    new cloudwatch.Alarm(this, 'EvalGatePassRateLowAlarm', {
      alarmName: 'PRISM-D1-EvalGatePassRate-Low',
      alarmDescription: 'Eval gate pass rate has dropped below 70%, indicating degraded quality in AI-generated outputs.',
      metric: new cloudwatch.Metric({
        namespace: METRIC_NAMESPACE,
        metricName: 'EvalGatePassRate',
        statistic: 'Average',
        period: cdk.Duration.hours(6),
      }),
      threshold: 70,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm: Change failure rate exceeding 20%
    new cloudwatch.Alarm(this, 'ChangeFailureRateHighAlarm', {
      alarmName: 'PRISM-D1-ChangeFailureRate-High',
      alarmDescription: 'Change failure rate exceeds 20%, indicating deployment quality regression.',
      metric: new cloudwatch.Metric({
        namespace: METRIC_NAMESPACE,
        metricName: 'ChangeFailureRate',
        statistic: 'Average',
        period: cdk.Duration.hours(6),
      }),
      threshold: 20,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Alarm: Agent success rate dropping below 80%
    new cloudwatch.Alarm(this, 'AgentSuccessRateAlarm', {
      metric: new cloudwatch.Metric({
        namespace: METRIC_NAMESPACE,
        metricName: 'AgentSuccessRate',
        dimensionsMap: { TeamId: teamId, Repository: repository },
        statistic: 'Average',
        period: cdk.Duration.hours(1),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      alarmDescription: 'Agent success rate below 80% for 3 consecutive hours',
      alarmName: `prism-d1-${teamId}-agent-success-rate`,
    });

    // -------------------------------------------------------
    // Outputs
    // -------------------------------------------------------
    new cdk.CfnOutput(this, 'TeamDashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=PRISM-D1-Team-Velocity`,
      description: 'Team Velocity Dashboard URL',
    });

    new cdk.CfnOutput(this, 'ExecDashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=PRISM-D1-Executive-Readout`,
      description: 'Executive Readout Dashboard URL',
    });
  }
}
