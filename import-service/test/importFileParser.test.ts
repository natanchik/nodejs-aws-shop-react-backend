import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { handler } from '../lambda/importFileParser';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';

jest.mock('@aws-sdk/client-s3');
jest.mock('csv-parser');
jest.mock('@aws-sdk/client-sqs');

describe('importFileParser lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SQS_URL = 'test-queue-url';
  });
  it('should process CSV file successfully', async () => {
    const mockStream = new Readable({
      read() {
        this.push('column1,column2\nvalue1,value2');
        this.push(null);
      },
    }) as unknown as Readable;

    (S3Client.prototype.send as jest.Mock).mockResolvedValue({
      Body: mockStream,
    });

    const event: S3Event = {
      Records: [
        {
          s3: {
            bucket: {
              name: 'test-bucket',
            },
            object: {
              key: 'uploaded/test.csv',
            },
          },
        },
      ],
    } as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    expect(response.body).toBe(JSON.stringify({ message: 'CSV processing completed' }));
    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'test-bucket', // Changed from 'XXXXXXXXXXX' to match the event bucket name
      Key: 'uploaded/test.csv',
    });
    expect(SQSClient.prototype.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: {
          QueueUrl: 'test-queue-url',
          MessageBody: expect.any(String),
        },
      }),
    );
  });

  it('should handle invalid file stream', async () => {
    (S3Client.prototype.send as jest.Mock).mockResolvedValue({
      Body: null,
    });

    const event: S3Event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'uploaded/test.csv' },
          },
        },
      ],
    } as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Internal server error',
    });
  });

  it('should handle stream errors', async () => {
    const mockStream = new Readable({
      read() {
        process.nextTick(() => this.emit('error', new Error('Stream error')));
      },
    });

    (S3Client.prototype.send as jest.Mock).mockResolvedValue({
      Body: mockStream,
    });

    const event: S3Event = {
      Records: [
        {
          s3: {
            bucket: { name: 'test-bucket' },
            object: { key: 'uploaded/test.csv' },
          },
        },
      ],
    } as any;

    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Internal server error',
    });
  });
});
