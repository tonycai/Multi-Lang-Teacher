# Instructions for Creating the Multi-Lang-Teacher Bedrock Agent

Follow these steps to create a Bedrock agent for the Multi-Lang-Teacher application in the AWS Console:

## 1. Prepare Resources

You should already have:
- IAM Role: `MultiLangTeacherBedrockAgentRole`
- API URL: Your deployed API Gateway URL (from CDK outputs)
- OpenAPI Schema: The `api-schema.json` file in this directory

## 2. Create the Bedrock Agent

1. Go to the [AWS Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. In the left navigation panel, select "Agents"
3. Click "Create agent"
4. Fill in the agent details:
   - **Name**: MultiLangTeacher
   - **Description**: AI language tutor for Chinese students learning English and Japanese
   - **Role (IAM)**: MultiLangTeacherBedrockAgentRole
   - **Foundation model**: anthropic.claude-3-sonnet-20240229-v1:0
   - **Agent instructions**: You are an AI-powered language tutor for students from mainland China learning English and Japanese. You help with grammar, vocabulary, pronunciation, and provide cultural context. You can explain in Simple Chinese, English, or Japanese based on student preference.
5. Click "Next"

## 3. Add Action Group

1. On the "Add action groups" page, click "Add"
2. Fill in the action group details:
   - **Name**: LanguageTutorActions
   - **Description**: Actions for language tutoring capabilities
   - **Action group API schema**: Upload the `api-schema.json` file from this directory
3. Under "API configuration":
   - Select "API endpoint URL"
   - Enter your API URL from CDK outputs
4. Click "Next"

## 4. Test and Prepare the Agent

1. On the "Review and prepare" page, review your settings and click "Prepare"
2. Wait for the agent to be prepared (this may take several minutes)

## 5. Create an Alias

1. Once the agent is prepared, go to the "Aliases" tab
2. Click "Create alias"
3. Fill in the alias details:
   - **Name**: production
   - **Description**: Production version of the Multi-Lang-Teacher agent
   - **Routing configuration**: Select version 1 (DRAFT)
4. Click "Create alias"

## 6. Test the Agent

1. Go to the "Test" tab
2. Use the testing panel to try out these example prompts:
   - "Can you explain the difference between 'affect' and 'effect'?"
   - "How do I use the Japanese particles は and が correctly?"
   - "我想学习英语中的过去完成时态，请用中文解释"

The agent will call your API and return responses from your Multi-Lang-Teacher application. 