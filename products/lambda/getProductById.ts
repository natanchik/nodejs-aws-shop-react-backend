import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const productId = event.pathParameters?.productId;

    if (!productId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'Product ID is required' }),
      };
    }

    const productResponse = await docClient.send(
      new GetCommand({
        TableName: process.env.PRODUCTS_TABLE!,
        Key: { id: productId },
      }),
    );

    if (!productResponse.Item) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'Product not found' }),
      };
    }

    const stockResponse = await docClient.send(
      new GetCommand({
        TableName: process.env.STOCKS_TABLE!,
        Key: { product_id: productId },
      }),
    );

    const joinedProduct = {
      id: productResponse.Item.id,
      title: productResponse.Item.title,
      description: productResponse.Item.description,
      price: productResponse.Item.price,
      count: stockResponse.Item?.count || 0,
    };

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(joinedProduct),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
