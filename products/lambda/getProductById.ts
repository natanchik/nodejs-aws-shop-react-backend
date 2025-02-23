import { APIGatewayProxyHandler } from 'aws-lambda';
import { products } from './mockData';

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { productId } = event.pathParameters || {};

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

    const product = products.find((p) => p.id === productId);

    if (!product) {
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ message: 'Product not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify(product),
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
