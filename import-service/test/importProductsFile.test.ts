import { APIGatewayProxyEvent } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { handler } from '../lambda/importProductsFile';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('importProductsFile lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BUCKET_NAME = 'test-bucket';
    process.env.UPLOADED_FOLDER = 'uploaded';
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
      Bucket: 'test-bucket',
      Key: 'uploaded/test.csv',
      ContentType: 'text/csv',
    });
  });

  it('should validate file extension', async () => {
    const event = {
      queryStringParameters: {
        name: 'test.txt',
      },
    } as unknown as APIGatewayProxyEvent;

    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Only CSV files are allowed',
    });
  });
});
