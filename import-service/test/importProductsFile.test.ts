import { APIGatewayProxyEvent } from 'aws-lambda';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { handler } from '../lambda/importProductsFile';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('importProductsFile lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return signed URL when filename is provided', async () => {
    const mockSignedUrl = 'https://mock-signed-url';
    (getSignedUrl as jest.Mock).mockResolvedValue(mockSignedUrl);

    const event = {
      queryStringParameters: {
        name: 'test.csv',
      },
    } as unknown as APIGatewayProxyEvent;

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(mockSignedUrl);
    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
      Key: 'uploaded/test.csv',
      ContentType: 'text/csv',
    });
  });

  it('should return 400 when filename is not provided', async () => {
    const event = {
      queryStringParameters: {},
    } as APIGatewayProxyEvent;

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: 'File name is required',
    });
  });

  it('should return 500 when S3 operation fails', async () => {
    (getSignedUrl as jest.Mock).mockRejectedValue(new Error('S3 Error'));

    const event = {
      queryStringParameters: {
        name: 'test.csv',
      },
    } as unknown as APIGatewayProxyEvent;

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Internal server error',
    });
  });
});
