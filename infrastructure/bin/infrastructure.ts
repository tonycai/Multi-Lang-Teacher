#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { MultiLangTeacherStack } from '../lib/multi-lang-teacher-stack';

const app = new cdk.App();
new MultiLangTeacherStack(app, 'MultiLangTeacherStack', {
  env: { 
    account: process.env.CDK_DEPLOY_ACCOUNT || process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEPLOY_REGION || process.env.CDK_DEFAULT_REGION
  },
  description: 'Multi-Lang-Teacher CDK stack with API Gateway, Lambda, Bedrock, and Pinecone integration',
});

app.synth(); 