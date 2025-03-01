import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../../lambda/getProductById';
import { createMockContext, createMockCallback } from './helpers';

describe('getProductById Lambda', () => {
  const mockContext = createMockContext();
  const mockCallback = createMockCallback;

  let callbackResponse: APIGatewayProxyResult | null = null;

  beforeEach(() => {
    callbackResponse = null;
  });

  it('should return product when valid ID is provided', async () => {
    const event = {
      httpMethod: 'GET',
      pathParameters: {
        productId: '1',
      },
    } as unknown as APIGatewayProxyEvent;

    const response = await handler(event, mockContext, mockCallback);
    const actualResponse = response || callbackResponse;

    expect(actualResponse).toBeDefined();
    expect(actualResponse!.statusCode).toBe(200);

    const body = JSON.parse(actualResponse!.body);
    expect(body).toHaveProperty('id', '1');
    expect(body).toHaveProperty('title');
    expect(body).toHaveProperty('price');
  });

  it('should return 404 when product is not found', async () => {
    const event = {
      httpMethod: 'GET',
      pathParameters: {
        productId: 'nonexistent',
      },
    } as unknown as APIGatewayProxyEvent;

    const response = await handler(event, mockContext, mockCallback);
    const actualResponse = response || callbackResponse;

    expect(actualResponse!.statusCode).toBe(404);
    expect(JSON.parse(actualResponse!.body)).toHaveProperty('message', 'Product not found');
  });
});
