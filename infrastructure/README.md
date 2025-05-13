# Multi-Lang-Teacher Infrastructure

This directory contains the AWS CDK code for deploying the Multi-Lang-Teacher application infrastructure to AWS.

## Prerequisites

- AWS CLI installed and configured
- Node.js (v14 or later)
- AWS CDK toolkit installed (`npm install -g aws-cdk`)

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Configure AWS environment variables:
   ```
   export CDK_DEPLOY_ACCOUNT=your-account-id
   export CDK_DEPLOY_REGION=your-region
   ```

## Deployment

1. Bootstrap the AWS environment (only needed once per account/region):
   ```
   npm run bootstrap
   ```
   or
   ```
   cdk bootstrap aws://${CDK_DEPLOY_ACCOUNT}/${CDK_DEPLOY_REGION}
   ```

2. Deploy the stacks:
   ```
   npm run deploy
   ```
   or
   ```
   cdk deploy --all --require-approval never
   ```

## Stack Structure

The infrastructure includes:

- **API Gateway** - For handling HTTP requests from the front-end
- **Lambda Functions**:
  - Main Logic - Primary request handling and orchestration
  - Pinecone Interaction - Vector database interactions
  - Data Processing - Storage and retrieval operations
- **DynamoDB Table** - For storing metadata
- **S3 Bucket** - For storing learning materials
- **Secrets Manager** - For storing Pinecone API keys
- **IAM Roles & Policies** - For service permissions

## Outputs

After deployment, the CDK will output:

- API Gateway endpoint URL
- S3 bucket name
- DynamoDB table name

## Clean Up

To delete all resources:

```
cdk destroy --all
```

## Project Structure

- `bin/` - CDK app entrypoint
- `lib/` - Stack definitions and constructs
- `cdk.json` - CDK configuration 