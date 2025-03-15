import { SQSEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { handler } from '../lambda/catalogBatchProcess';

jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');
jest.mock('@aws-sdk/client-sns');

describe('catalogBatchProcess lambda', () => {
  const mockProduct = {
    title: 'Test Product',
    description: 'Test Description',
    price: 100,
    count: 5,
  };

  const mockSQSEvent: SQSEvent = {
    Records: [
      {
        body: JSON.stringify(mockProduct),
      } as any,
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PRODUCTS_TABLE = 'test-products-table';
    process.env.STOCKS_TABLE = 'test-stocks-table';
    process.env.SNS_TOPIC_ARN = 'test-sns-topic';

    // Mock DynamoDB send method
    const mockDynamoSend = jest.fn().mockResolvedValue({});
    (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({
      send: mockDynamoSend,
    });

    // Mock SNS send method
    const mockSNSSend = jest.fn().mockResolvedValue({});
    (SNSClient.prototype.send as jest.Mock).mockImplementation(mockSNSSend);
  });

  it('should process products and create records in DynamoDB', async () => {
    const response = await handler(mockSQSEvent);

    // Verify response
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Products created successfully',
    });

    // Verify DynamoDB calls
    expect(DynamoDBDocumentClient.from).toHaveBeenCalled();
    const mockDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

    // Verify product creation
    expect(mockDocClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: 'test-products-table',
          Item: expect.objectContaining({
            title: mockProduct.title,
            description: mockProduct.description,
            price: mockProduct.price,
          }),
        }),
      }),
    );

    // Verify stock creation
    expect(mockDocClient.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TableName: 'test-stocks-table',
          Item: expect.objectContaining({
            count: mockProduct.count,
          }),
        }),
      }),
    );
  });

  it('should send notification to SNS', async () => {
    await handler(mockSQSEvent);

    // Verify SNS message
    expect(SNSClient.prototype.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          TopicArn: 'test-sns-topic',
          Subject: 'Products Created',
          Message: expect.stringContaining('Successfully created 1 products'),
          MessageAttributes: expect.objectContaining({
            price: expect.objectContaining({
              DataType: 'Number',
              StringValue: '100',
            }),
          }),
        }),
      }),
    );
  });

  it('should handle errors and throw them', async () => {
    const mockError = new Error('Test error');
    (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({
      send: jest.fn().mockRejectedValue(mockError),
    });

    await expect(handler(mockSQSEvent)).rejects.toThrow('Test error');
  });

  it('should process multiple records', async () => {
    const multipleProducts = {
      Records: [
        { body: JSON.stringify(mockProduct) },
        { body: JSON.stringify({ ...mockProduct, title: 'Second Product' }) },
      ],
    } as SQSEvent;

    const response = await handler(multipleProducts);

    expect(response.statusCode).toBe(200);
    const mockDocClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    expect(mockDocClient.send).toHaveBeenCalledTimes(4); // 2 products × (1 product + 1 stock) calls
  });
});
