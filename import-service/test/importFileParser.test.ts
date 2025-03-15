import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { handler } from '../lambda/importFileParser';

jest.mock('@aws-sdk/client-s3');
jest.mock('csv-parser');

describe('importFileParser lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    expect(response.body).toBe('CSV processing completed');
    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'XXXXXXXXXXX',
      Key: 'uploaded/test.csv',
    });
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
        this.emit('error', new Error('Stream error'));
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

    await expect(handler(event)).rejects.toThrow('Stream error');
  });
});
