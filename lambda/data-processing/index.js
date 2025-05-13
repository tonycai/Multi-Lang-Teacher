// Data Processing Lambda Function for Multi-Lang-Teacher
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

// Constants
const METADATA_TABLE = process.env.METADATA_TABLE;
const LEARNING_MATERIALS_BUCKET = process.env.LEARNING_MATERIALS_BUCKET;

/**
 * Main handler function for data processing
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
      return await processData(event);
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
    case 'upload':
      return await handleUpload(body);
    case 'retrieve':
      return await handleRetrieve(body);
    case 'list':
      return await handleListMaterials(body);
    case 'delete':
      return await handleDeleteMaterial(body);
    default:
      return formatResponse(400, { message: 'Invalid action' });
  }
}

/**
 * Process data (when invoked from another Lambda)
 */
async function processData(params) {
  const { action } = params;
  
  switch (action) {
    case 'upload':
      return await handleUpload(params);
    case 'retrieve':
      return await handleRetrieve(params);
    case 'list':
      return await handleListMaterials(params);
    case 'delete':
      return await handleDeleteMaterial(params);
    default:
      return { 
        statusCode: 400, 
        body: JSON.stringify({ message: 'Invalid action' }) 
      };
  }
}

/**
 * Handle uploading learning material
 */
async function handleUpload(params) {
  const { 
    content, 
    fileName, 
    language = 'english', 
    type = 'general',
    description = '',
    teacher_id,
    contentType = 'text/plain'
  } = params;
  
  if (!content || !fileName) {
    return formatResponse(400, { message: 'Content and fileName are required' });
  }
  
  try {
    // 1. Generate a unique ID
    const materialId = `material_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    // 2. Upload to S3
    const s3Key = `${language}/${type}/${materialId}/${fileName}`;
    await s3.putObject({
      Bucket: LEARNING_MATERIALS_BUCKET,
      Key: s3Key,
      Body: Buffer.from(content, 'utf-8'),
      ContentType: contentType
    }).promise();
    
    // 3. Store metadata in DynamoDB
    const metadata = {
      id: materialId,
      file_name: fileName,
      s3_key: s3Key,
      language,
      type,
      description,
      teacher_id: teacher_id || 'system',
      upload_date: new Date().toISOString(),
      content_preview: content.substring(0, 300) + (content.length > 300 ? '...' : '')
    };
    
    await dynamodb.put({
      TableName: METADATA_TABLE,
      Item: metadata
    }).promise();
    
    // 4. If Pinecone integration is enabled, invoke the Pinecone Lambda to index this content
    try {
      await lambda.invoke({
        FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME.replace('data-processing', 'pinecone-interaction'),
        InvocationType: 'Event', // Asynchronous
        Payload: JSON.stringify({
          action: 'upsert',
          documents: [{
            id: materialId,
            content,
            language,
            type,
            source: 'learning_material'
          }]
        })
      }).promise();
    } catch (pineconeError) {
      console.error('Error invoking Pinecone for indexing:', pineconeError);
      // Continue even if Pinecone indexing fails
    }
    
    return formatResponse(200, { 
      message: 'Material uploaded successfully',
      materialId,
      s3Key
    });
  } catch (error) {
    console.error('Error uploading material:', error);
    return formatResponse(500, { message: 'Error uploading material', error: error.message });
  }
}

/**
 * Handle retrieving learning material
 */
async function handleRetrieve(params) {
  const { materialId, fileKey } = params;
  
  if (!materialId && !fileKey) {
    return formatResponse(400, { message: 'Either materialId or fileKey is required' });
  }
  
  try {
    let s3Key;
    
    // If materialId is provided, look up the S3 key in DynamoDB
    if (materialId) {
      const result = await dynamodb.get({
        TableName: METADATA_TABLE,
        Key: { id: materialId }
      }).promise();
      
      if (!result.Item) {
        return formatResponse(404, { message: 'Material not found' });
      }
      
      s3Key = result.Item.s3_key;
    } else {
      s3Key = fileKey;
    }
    
    // Retrieve from S3
    const s3Object = await s3.getObject({
      Bucket: LEARNING_MATERIALS_BUCKET,
      Key: s3Key
    }).promise();
    
    const content = s3Object.Body.toString('utf-8');
    
    return formatResponse(200, { 
      content,
      contentType: s3Object.ContentType,
      metadata: s3Object.Metadata
    });
  } catch (error) {
    console.error('Error retrieving material:', error);
    return formatResponse(500, { message: 'Error retrieving material', error: error.message });
  }
}

/**
 * Handle listing learning materials
 */
async function handleListMaterials(params) {
  const { 
    language,
    type,
    limit = 50,
    lastEvaluatedKey
  } = params;
  
  try {
    // Build filter expression if language or type is specified
    let filterExpression = '';
    const expressionAttributeValues = {};
    
    if (language) {
      filterExpression += 'language = :language';
      expressionAttributeValues[':language'] = language;
    }
    
    if (type) {
      if (filterExpression) {
        filterExpression += ' AND ';
      }
      filterExpression += 'type = :type';
      expressionAttributeValues[':type'] = type;
    }
    
    // Query parameters
    const queryParams = {
      TableName: METADATA_TABLE,
      Limit: limit
    };
    
    // Add filter expression if we have one
    if (filterExpression) {
      queryParams.FilterExpression = filterExpression;
      queryParams.ExpressionAttributeValues = expressionAttributeValues;
    }
    
    // Add pagination token if provided
    if (lastEvaluatedKey) {
      queryParams.ExclusiveStartKey = JSON.parse(Buffer.from(lastEvaluatedKey, 'base64').toString());
    }
    
    // Query DynamoDB
    const result = await dynamodb.scan(queryParams).promise();
    
    // Format response
    const response = {
      materials: result.Items,
      count: result.Items.length
    };
    
    // Add pagination token if more results are available
    if (result.LastEvaluatedKey) {
      response.nextToken = Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64');
    }
    
    return formatResponse(200, response);
  } catch (error) {
    console.error('Error listing materials:', error);
    return formatResponse(500, { message: 'Error listing materials', error: error.message });
  }
}

/**
 * Handle deleting learning material
 */
async function handleDeleteMaterial(params) {
  const { materialId } = params;
  
  if (!materialId) {
    return formatResponse(400, { message: 'materialId is required' });
  }
  
  try {
    // 1. Get the S3 key from DynamoDB
    const result = await dynamodb.get({
      TableName: METADATA_TABLE,
      Key: { id: materialId }
    }).promise();
    
    if (!result.Item) {
      return formatResponse(404, { message: 'Material not found' });
    }
    
    const s3Key = result.Item.s3_key;
    
    // 2. Delete from S3
    await s3.deleteObject({
      Bucket: LEARNING_MATERIALS_BUCKET,
      Key: s3Key
    }).promise();
    
    // 3. Delete metadata from DynamoDB
    await dynamodb.delete({
      TableName: METADATA_TABLE,
      Key: { id: materialId }
    }).promise();
    
    return formatResponse(200, { 
      message: 'Material deleted successfully',
      materialId
    });
  } catch (error) {
    console.error('Error deleting material:', error);
    return formatResponse(500, { message: 'Error deleting material', error: error.message });
  }
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
      'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,DELETE',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(body)
  };
} 