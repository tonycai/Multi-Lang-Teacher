// Main Logic Lambda Function for Multi-Lang-Teacher
const AWS = require('aws-sdk');
const lambda = new AWS.Lambda();
const secretsManager = new AWS.SecretsManager();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const bedrock = new AWS.BedrockRuntime();

// Constants
const METADATA_TABLE = process.env.METADATA_TABLE;
const LEARNING_MATERIALS_BUCKET = process.env.LEARNING_MATERIALS_BUCKET;
const PINECONE_API_KEY_SECRET_ARN = process.env.PINECONE_API_KEY_SECRET_ARN;
const BEDROCK_MODEL_ID = 'anthropic.claude-sonnet-3-haiku-20240307-v1:0'; // Claude Sonnet Haiku model

/**
 * Main handler function for the API Gateway
 */
exports.handler = async (event) => {
  console.log('Event received:', JSON.stringify(event));
  
  try {
    // Parse the request body
    const body = JSON.parse(event.body || '{}');
    const path = event.path || '/';
    const httpMethod = event.httpMethod || 'POST';
    
    // Route the request based on path and method
    if (path === '/' || path === '/query') {
      return await handleQuery(body);
    } else if (path === '/feedback') {
      return await handleFeedback(body);
    } else {
      return formatResponse(404, { message: 'Route not found' });
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return formatResponse(500, { message: 'Internal server error', error: error.message });
  }
};

/**
 * Handle a query request
 */
async function handleQuery(body) {
  const { query, language, explanation_language, student_id } = body;
  
  if (!query) {
    return formatResponse(400, { message: 'Query is required' });
  }
  
  try {
    // 1. Get relevant context from Pinecone via the Pinecone Interaction Lambda
    const context = await getContextFromPinecone(query, language);
    
    // 2. Process the query with Bedrock (Claude Sonnet)
    const bedrockResponse = await invokeBedrockModel(query, language, explanation_language, context);
    
    // 3. Format and return the response
    return formatResponse(200, {
      response: bedrockResponse,
      language: language || 'english',
      explanation_language: explanation_language || language || 'english'
    });
  } catch (error) {
    console.error('Error handling query:', error);
    return formatResponse(500, { message: 'Error processing your query', error: error.message });
  }
}

/**
 * Handle a feedback request
 */
async function handleFeedback(body) {
  const { feedback, response_id, student_id } = body;
  
  if (!feedback || !response_id) {
    return formatResponse(400, { message: 'Feedback and response_id are required' });
  }
  
  try {
    // Store the feedback in DynamoDB
    await dynamodb.put({
      TableName: METADATA_TABLE,
      Item: {
        id: `feedback_${response_id}`,
        feedback,
        response_id,
        student_id: student_id || 'anonymous',
        timestamp: new Date().toISOString()
      }
    }).promise();
    
    return formatResponse(200, { message: 'Feedback received, thank you!' });
  } catch (error) {
    console.error('Error handling feedback:', error);
    return formatResponse(500, { message: 'Error storing your feedback', error: error.message });
  }
}

/**
 * Get context from Pinecone by invoking the Pinecone Interaction Lambda
 */
async function getContextFromPinecone(query, language) {
  try {
    const params = {
      FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME.replace('main-logic', 'pinecone-interaction'),
      InvocationType: 'RequestResponse',
      Payload: JSON.stringify({
        query,
        language: language || 'english',
        limit: 5
      })
    };
    
    const response = await lambda.invoke(params).promise();
    const payload = JSON.parse(response.Payload);
    
    if (payload.statusCode !== 200) {
      throw new Error(`Error from Pinecone Interaction Lambda: ${payload.body}`);
    }
    
    return JSON.parse(payload.body).results;
  } catch (error) {
    console.error('Error getting context from Pinecone:', error);
    // Return empty context if there's an error, so the main processing can continue
    return [];
  }
}

/**
 * Invoke the Bedrock model (Claude Sonnet)
 */
async function invokeBedrockModel(query, language, explanation_language, context) {
  // Create the prompt for Claude Sonnet
  const prompt = createPrompt(query, language, explanation_language, context);
  
  // Invoke Claude Sonnet via Bedrock
  try {
    const response = await bedrock.invokeModel({
      modelId: BEDROCK_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    }).promise();
    
    const responseBody = JSON.parse(Buffer.from(response.body).toString());
    return responseBody.content[0].text;
  } catch (error) {
    console.error('Error invoking Bedrock model:', error);
    throw new Error(`Error invoking language model: ${error.message}`);
  }
}

/**
 * Create a prompt for the language model
 */
function createPrompt(query, language, explanation_language, context) {
  const targetLanguage = language || 'english';
  const explainLanguage = explanation_language || targetLanguage || 'english';
  
  // Convert language names to Simple Chinese if needed
  const languageInChinese = {
    english: '英语',
    japanese: '日语',
    chinese: '简体中文'
  };
  
  // Base prompt with system instructions
  let prompt = `You are a helpful, accurate and supportive language tutor for students from mainland China learning ${targetLanguage}. 
You provide clear explanations and examples. The student's primary language is Simple Chinese (简体中文).

`;

  // Add language-specific instructions
  if (targetLanguage.toLowerCase() === 'english') {
    prompt += `When explaining English concepts, you should provide:
1. Clear explanations in ${explainLanguage}
2. Example sentences demonstrating usage
3. If requested, pronunciation guidance using pinyin approximations
`;
  } else if (targetLanguage.toLowerCase() === 'japanese') {
    prompt += `When explaining Japanese concepts, you should provide:
1. Clear explanations in ${explainLanguage}
2. Example sentences demonstrating usage
3. If requested, pronunciation guidance with Chinese phonetic approximations
4. Appropriate kanji usage with furigana when helpful
`;
  }

  // Add explanation language preference
  prompt += `\nThe student has requested explanations in ${explainLanguage}`;
  if (explainLanguage.toLowerCase() === 'chinese') {
    prompt += ' (简体中文)';
  }
  prompt += '.\n\n';

  // Add context from Pinecone if available
  if (context && context.length > 0) {
    prompt += 'Here is some relevant information that might help answer the question:\n\n';
    
    context.forEach((item, index) => {
      prompt += `Source ${index + 1}: ${item.content}\n\n`;
    });
    
    prompt += 'Using the above information as reference where applicable, ';
  }

  // Add the actual query and response instructions
  prompt += `The student's question is: "${query}"\n\n`;
  prompt += `Respond in ${explainLanguage}`;
  if (explainLanguage.toLowerCase() === 'chinese') {
    prompt += ' (简体中文)';
  }
  prompt += '.\n';

  return prompt;
}

/**
 * Format an API Gateway response
 */
function formatResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body)
  };
} 