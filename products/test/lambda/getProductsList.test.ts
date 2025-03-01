import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../../lambda/getProductsList';
import { createMockContext, createMockCallback } from './helpers';

describe('getProductsList Lambda', () => {
  const mockContext = createMockContext();
  const mockCallback = createMockCallback;
  let callbackResponse: APIGatewayProxyResult | null = null;

  beforeEach(() => {
    callbackResponse = null;
  });

  it('should return list of products', async () => {
    const event = {
      httpMethod: 'GET',
      path: '/products',
    } as APIGatewayProxyEvent;

    const response = await handler(event, mockContext, mockCallback);
    const actualResponse = response || callbackResponse;

    expect(actualResponse).toBeDefined();
    expect(actualResponse!.statusCode).toBe(200);

    const body = JSON.parse(actualResponse!.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    const product = body[0];
    expect(product).toHaveProperty('id');
    expect(product).toHaveProperty('title');
    expect(product).toHaveProperty('price');
  });
});
