import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import csv = require('csv-parser');
import { Readable } from 'stream';

const s3Client = new S3Client({});
const sqsClient = new SQSClient({});

export const handler = async (event: S3Event) => {
  try {
    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

      console.log(`Processing file ${key} from bucket ${bucket}`);

      const { Body } = await s3Client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );

      if (!(Body instanceof Readable)) {
        throw new Error('Invalid file stream');
      }

      await new Promise((resolve, reject) => {
        Body.pipe(csv())
          .on('data', async (data) => {
            try {
              await sqsClient.send(
                new SendMessageCommand({
                  QueueUrl: process.env.SQS_URL,
                  MessageBody: JSON.stringify(data),
                }),
              );
            } catch (error) {
              console.error('Error sending message to SQS:', error);
            }
          })
          .on('end', async () => {
            try {
              // Move file from uploaded to parsed folder
              const newKey = key.replace('uploaded', 'parsed');
              await s3Client.send(
                new CopyObjectCommand({
                  Bucket: bucket,
                  CopySource: `${bucket}/${key}`,
                  Key: newKey,
                }),
              );

              await s3Client.send(
                new DeleteObjectCommand({
                  Bucket: bucket,
                  Key: key,
                }),
              );

              resolve(true);
            } catch (error) {
              reject(error);
            }
          })
          .on('error', reject);
      });
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'CSV processing completed' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
