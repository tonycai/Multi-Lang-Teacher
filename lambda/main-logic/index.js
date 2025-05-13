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

// Bedrock model configuration
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-sonnet-20240229-v1:0';
const BEDROCK_MODEL_PARAMS = {
  temperature: parseFloat(process.env.BEDROCK_TEMPERATURE || '0.7'),
  top_p: parseFloat(process.env.BEDROCK_TOP_P || '0.9'),
  max_tokens: parseInt(process.env.BEDROCK_MAX_TOKENS || '2000')
};

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
    } else if (path === '/configure') {
      return await handleConfigure(body);
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
  const { query, language, explanation_language, student_id, session_id, model_params } = body;
  
  if (!query) {
    return formatResponse(400, { message: 'Query is required' });
  }
  
  try {
    // 1. Get relevant context from Pinecone via the Pinecone Interaction Lambda
    const context = await getContextFromPinecone(query, language);
    
    // 2. Process the query with Bedrock (Claude Sonnet)
    const customModelParams = model_params || {};
    const bedrockResponse = await invokeBedrockModel(
      query, 
      language, 
      explanation_language, 
      context,
      session_id,
      customModelParams
    );
    
    // 3. Log the interaction for future reference if student_id is provided
    if (student_id) {
      await logInteraction(student_id, query, bedrockResponse, language, explanation_language, session_id);
    }
    
    // 4. Format and return the response
    return formatResponse(200, {
      response: bedrockResponse,
      language: language || 'english',
      explanation_language: explanation_language || language || 'english',
      session_id: session_id
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
  const { feedback, response_id, student_id, rating } = body;
  
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
        rating: rating || null,
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
 * Handle configuration changes for the agent
 */
async function handleConfigure(body) {
  const { model_id, temperature, top_p, max_tokens } = body;
  
  if (!model_id && !temperature && !top_p && !max_tokens) {
    return formatResponse(400, { message: 'At least one configuration parameter is required' });
  }
  
  // This is a simple immediate configuration - in a production system
  // you would likely store these in a database or parameter store
  const currentConfig = {
    model_id: BEDROCK_MODEL_ID,
    temperature: BEDROCK_MODEL_PARAMS.temperature,
    top_p: BEDROCK_MODEL_PARAMS.top_p,
    max_tokens: BEDROCK_MODEL_PARAMS.max_tokens
  };
  
  return formatResponse(200, { 
    message: 'Configuration information',
    current_config: currentConfig,
    note: 'To change configuration permanently, update the environment variables in the Lambda function.'
  });
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
 * Log interaction for future reference
 */
async function logInteraction(student_id, query, response, language, explanation_language, session_id) {
  try {
    const interaction_id = `interaction_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    await dynamodb.put({
      TableName: METADATA_TABLE,
      Item: {
        id: interaction_id,
        student_id,
        query,
        response,
        language: language || 'english',
        explanation_language: explanation_language || language || 'english',
        session_id: session_id || interaction_id,
        timestamp: new Date().toISOString()
      }
    }).promise();
  } catch (error) {
    console.error('Error logging interaction:', error);
    // Don't fail the main flow if logging fails
  }
}

/**
 * Invoke the Bedrock model (Claude Sonnet)
 */
async function invokeBedrockModel(query, language, explanation_language, context, session_id, customModelParams = {}) {
  // Create the prompt for Claude
  const prompt = createPrompt(query, language, explanation_language, context, session_id);
  
  // Configure model parameters
  const modelParams = {
    temperature: customModelParams.temperature ?? BEDROCK_MODEL_PARAMS.temperature,
    top_p: customModelParams.top_p ?? BEDROCK_MODEL_PARAMS.top_p,
    max_tokens: customModelParams.max_tokens ?? BEDROCK_MODEL_PARAMS.max_tokens
  };
  
  // Use custom model if specified, otherwise use default
  const modelId = customModelParams.model_id ?? BEDROCK_MODEL_ID;
  
  // Invoke Claude via Bedrock
  try {
    // Log the prompt for debugging
    console.log(`Invoking model ${modelId} with prompt:`, prompt.substring(0, 100) + '...');
    
    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: modelParams.max_tokens,
      temperature: modelParams.temperature,
      top_p: modelParams.top_p,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };
    
    // Add system message if session ID is provided for continuity
    if (session_id) {
      requestBody.system = "You are a helpful, accurate, and supportive language tutor for students from mainland China learning foreign languages. You provide personalized guidance, clear explanations, and follow up on previous interactions in the most helpful way.";
    }
    
    const response = await bedrock.invokeModel({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(requestBody)
    }).promise();
    
    const responseBody = JSON.parse(Buffer.from(response.body).toString());
    return responseBody.content[0].text;
  } catch (error) {
    console.error('Error invoking Bedrock model:', error);
    
    // Handle specific Bedrock errors
    if (error.code === 'ModelTimeoutException') {
      throw new Error('The language model took too long to respond. Please try a shorter query.');
    } else if (error.code === 'ValidationException') {
      throw new Error('Invalid request to the language model. Please check your query and try again.');
    } else if (error.code === 'ModelNotReadyException') {
      throw new Error('The language model is currently not available. Please try again later.');
    } else {
      throw new Error(`Error invoking language model: ${error.message}`);
    }
  }
}

/**
 * Create a prompt for the language model
 */
function createPrompt(query, language, explanation_language, context, session_id) {
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
You provide clear explanations, examples, and personalized guidance. The student's primary language is Simple Chinese (简体中文).

`;

  // Add language-specific instructions
  if (targetLanguage.toLowerCase() === 'english') {
    prompt += `When explaining English concepts, you should provide:
1. Clear explanations in ${explainLanguage}
2. Relevant example sentences demonstrating proper usage
3. Common mistakes made by Chinese speakers learning English and how to avoid them
4. If pronunciation is discussed, provide pinyin approximations that would help Chinese speakers
5. Cultural context when relevant to language usage
`;
  } else if (targetLanguage.toLowerCase() === 'japanese') {
    prompt += `When explaining Japanese concepts, you should provide:
1. Clear explanations in ${explainLanguage}
2. Example sentences demonstrating proper usage with kanji, hiragana, and katakana as appropriate
3. Common mistakes made by Chinese speakers learning Japanese and how to avoid them
4. If pronunciation is discussed, provide Chinese phonetic approximations
5. Appropriate kanji usage with furigana when helpful
6. Cultural context when relevant to language usage
`;
  }

  // Add explanation language preference
  prompt += `\nThe student has requested explanations in ${explainLanguage}`;
  if (explainLanguage.toLowerCase() === 'chinese') {
    prompt += ' (简体中文)';
  }
  prompt += '.\n\n';

  // Add session context if available
  if (session_id) {
    prompt += `This is part of an ongoing tutoring session (${session_id}). If this follows previous questions, make sure your response takes the conversation context into account.\n\n`;
  }

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
  
  // Add specific formatting instructions
  prompt += `Format your response in a clear, structured way with appropriate headings and bullet points when needed. If explaining grammar points, include a "Practice" section with 1-2 simple exercises to help reinforce learning.\n`;

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