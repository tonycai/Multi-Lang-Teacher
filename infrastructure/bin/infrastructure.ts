#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MultiLangTeacherCoreStack } from '../lib/multi-lang-teacher-core-stack';
import { MultiLangTeacherStack } from '../lib/multi-lang-teacher-stack';
import { MultiLangTeacherAgentStack } from '../lib/multi-lang-teacher-agent-stack';

const app = new cdk.App();

// Environment configuration
const env = { 
  account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION
};

// Create the stacks
const coreStack = new MultiLangTeacherCoreStack(app, 'MultiLangTeacherCoreStack', {
  env,
  description: 'Core resources for Multi-Lang-Teacher (DynamoDB, S3, Secrets)',
});

const apiStack = new MultiLangTeacherStack(app, 'MultiLangTeacherApiStack', {
  env,
  description: 'API Gateway and Lambda functions for Multi-Lang-Teacher',
  coreStack,
});

const agentStack = new MultiLangTeacherAgentStack(app, 'MultiLangTeacherAgentStack', {
  env,
  description: 'Bedrock Agent resources for Multi-Lang-Teacher',
  apiStack,
});

// Add dependencies
apiStack.addDependency(coreStack);
agentStack.addDependency(apiStack);

app.synth(); 