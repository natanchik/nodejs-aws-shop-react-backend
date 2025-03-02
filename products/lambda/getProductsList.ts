import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler: APIGatewayProxyHandler = async () => {
  try {
    const productsResponse = await docClient.send(
      new ScanCommand({
        TableName: 'products',
      }),
    );

    const stocksResponse = await docClient.send(
      new ScanCommand({
        TableName: 'stocks',
      }),
    );

    const joinedProducts = productsResponse.Items?.map((product) => {
      const stock = stocksResponse.Items?.find((stock) => stock.product_id === product.id);
      return {
        id: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        count: stock?.count || 0,
      };
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(joinedProducts),
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
