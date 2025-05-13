// Pinecone Interaction Lambda Function for Multi-Lang-Teacher
const AWS = require('aws-sdk');
const axios = require('axios'); // We'll need to add this package to the deployment
const secretsManager = new AWS.SecretsManager();
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Constants
const METADATA_TABLE = process.env.METADATA_TABLE;
const PINECONE_API_KEY_SECRET_ARN = process.env.PINECONE_API_KEY_SECRET_ARN;
const PINECONE_ENVIRONMENT = 'us-west1-gcp'; // This would typically come from env vars
const PINECONE_INDEX_NAME = 'multi-lang-teacher'; // This would typically come from env vars

/**
 * Main handler function for Pinecone interactions
 */
exports.handler = async (event) => {
  console.log('Event received:', JSON.stringify(event));
  
  try {
    // If this is invoked directly from API Gateway
    if (event.httpMethod) {
      const body = JSON.parse(event.body || '{}');
      return await handleDirectRequest(body);
    } 
    // If this is invoked from another Lambda
    else {
      return await handleVectorSearch(event);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return formatResponse(500, { message: 'Internal server error', error: error.message });
  }
};

/**
 * Handle direct API Gateway requests
 */
async function handleDirectRequest(body) {
  const { action } = body;
  
  switch (action) {
    case 'search':
      return await handleVectorSearch(body);
    case 'upsert':
      return await handleUpsert(body);
    default:
      return formatResponse(400, { message: 'Invalid action' });
  }
}

/**
 * Handle vector search using Pinecone
 */
async function handleVectorSearch(params) {
  const { query, language = 'english', limit = 5, filter = {} } = params;
  
  if (!query) {
    return formatResponse(400, { message: 'Query is required' });
  }
  
  try {
    // 1. Get Pinecone API key from Secrets Manager
    const pineconeApiKey = await getPineconeApiKey();
    
    // 2. Generate embedding for the query using a separate Lambda or service
    // For simplicity, we're assuming this is handled elsewhere in a real implementation
    // This would normally call an embedding API like AWS Bedrock, OpenAI, or similar
    const embedding = await generateMockEmbedding(query); // In a real system, this would use a proper embedding model
    
    // 3. Query Pinecone
    const pineconeResults = await queryPinecone(embedding, limit, filter, pineconeApiKey);
    
    // 4. Fetch metadata for the results from DynamoDB
    const enrichedResults = await enrichResultsWithMetadata(pineconeResults);
    
    return formatResponse(200, { 
      results: enrichedResults,
      query,
      language
    });
  } catch (error) {
    console.error('Error handling vector search:', error);
    return formatResponse(500, { message: 'Error processing vector search', error: error.message });
  }
}

/**
 * Handle upserting vectors to Pinecone
 */
async function handleUpsert(params) {
  const { documents, namespace = 'default' } = params;
  
  if (!documents || !Array.isArray(documents) || documents.length === 0) {
    return formatResponse(400, { message: 'Documents array is required' });
  }
  
  try {
    // 1. Get Pinecone API key from Secrets Manager
    const pineconeApiKey = await getPineconeApiKey();
    
    // 2. Process each document
    const vectors = [];
    const metadataItems = [];
    
    for (const doc of documents) {
      // Generate a unique ID if not provided
      const id = doc.id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      
      // Generate embedding
      const embedding = await generateMockEmbedding(doc.content);
      
      // Prepare vector for Pinecone
      vectors.push({
        id,
        values: embedding,
        metadata: {
          language: doc.language || 'english',
          type: doc.type || 'general',
          source: doc.source || 'user_uploaded',
        }
      });
      
      // Prepare metadata for DynamoDB
      metadataItems.push({
        id,
        content: doc.content,
        language: doc.language || 'english',
        type: doc.type || 'general',
        source: doc.source || 'user_uploaded',
        timestamp: new Date().toISOString()
      });
    }
    
    // 3. Upsert vectors to Pinecone
    await upsertToPinecone(vectors, namespace, pineconeApiKey);
    
    // 4. Store metadata in DynamoDB
    await storeMetadata(metadataItems);
    
    return formatResponse(200, { 
      message: 'Documents processed successfully',
      count: documents.length
    });
  } catch (error) {
    console.error('Error handling upsert:', error);
    return formatResponse(500, { message: 'Error processing upsert', error: error.message });
  }
}

/**
 * Get Pinecone API key from Secrets Manager
 */
async function getPineconeApiKey() {
  try {
    const data = await secretsManager.getSecretValue({
      SecretId: PINECONE_API_KEY_SECRET_ARN
    }).promise();
    
    const secret = JSON.parse(data.SecretString);
    return secret.pineconeApiKey;
  } catch (error) {
    console.error('Error retrieving Pinecone API key:', error);
    throw new Error('Could not retrieve Pinecone API key');
  }
}

/**
 * Query Pinecone with an embedding
 */
async function queryPinecone(embedding, limit, filter, apiKey) {
  const pineconeUrl = `https://${PINECONE_INDEX_NAME}-${PINECONE_ENVIRONMENT}.svc.${PINECONE_ENVIRONMENT}.pinecone.io/query`;
  
  try {
    const response = await axios({
      method: 'post',
      url: pineconeUrl,
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      data: {
        vector: embedding,
        topK: limit,
        includeMetadata: true,
        filter
      }
    });
    
    return response.data.matches;
  } catch (error) {
    console.error('Error querying Pinecone:', error);
    throw new Error(`Error querying Pinecone: ${error.message}`);
  }
}

/**
 * Upsert vectors to Pinecone
 */
async function upsertToPinecone(vectors, namespace, apiKey) {
  const pineconeUrl = `https://${PINECONE_INDEX_NAME}-${PINECONE_ENVIRONMENT}.svc.${PINECONE_ENVIRONMENT}.pinecone.io/vectors/upsert`;
  
  try {
    await axios({
      method: 'post',
      url: pineconeUrl,
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      data: {
        vectors,
        namespace
      }
    });
  } catch (error) {
    console.error('Error upserting to Pinecone:', error);
    throw new Error(`Error upserting to Pinecone: ${error.message}`);
  }
}

/**
 * Store metadata in DynamoDB
 */
async function storeMetadata(items) {
  const batchSize = 25; // DynamoDB batch write limit
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const params = {
      RequestItems: {
        [METADATA_TABLE]: batch.map(item => ({
          PutRequest: {
            Item: item
          }
        }))
      }
    };
    
    await dynamodb.batchWrite(params).promise();
  }
}

/**
 * Enrich Pinecone results with metadata from DynamoDB
 */
async function enrichResultsWithMetadata(pineconeResults) {
  if (!pineconeResults || pineconeResults.length === 0) {
    return [];
  }
  
  // Get all document IDs
  const ids = pineconeResults.map(result => result.id);
  
  // Query DynamoDB for all IDs in batches
  const batchSize = 100;
  let allItems = [];
  
  for (let i = 0; i < ids.length; i += batchSize) {
    const batchIds = ids.slice(i, i + batchSize);
    
    const params = {
      RequestItems: {
        [METADATA_TABLE]: {
          Keys: batchIds.map(id => ({ id }))
        }
      }
    };
    
    const response = await dynamodb.batchGet(params).promise();
    const items = response.Responses[METADATA_TABLE];
    allItems = allItems.concat(items);
  }
  
  // Create a map of ID to item for fast lookup
  const itemMap = {};
  allItems.forEach(item => {
    itemMap[item.id] = item;
  });
  
  // Combine Pinecone results with DynamoDB metadata
  return pineconeResults.map(result => {
    const metadata = itemMap[result.id] || {};
    return {
      id: result.id,
      score: result.score,
      content: metadata.content || '',
      language: metadata.language || result.metadata?.language || 'english',
      type: metadata.type || result.metadata?.type || 'general',
      source: metadata.source || result.metadata?.source || 'unknown'
    };
  });
}

/**
 * Generate a mock embedding (for demonstration purposes only)
 * In a real implementation, this would call an embedding service
 */
async function generateMockEmbedding(text) {
  // This is just a placeholder - in a real system, you'd use a proper embedding model
  // For example, via AWS Bedrock, OpenAI, or similar services
  
  // Create a deterministic but random-seeming vector based on the text
  // This is NOT suitable for production use, just for demonstration
  const seed = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const rand = (n) => {
    const x = Math.sin(n) * 10000;
    return x - Math.floor(x);
  };
  
  const dimension = 1536; // Common embedding dimension
  const embedding = [];
  
  for (let i = 0; i < dimension; i++) {
    embedding.push(rand(seed + i) * 2 - 1); // Values between -1 and 1
  }
  
  // Normalize the vector to unit length
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map(val => val / magnitude);
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