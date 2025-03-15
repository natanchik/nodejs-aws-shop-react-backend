import { S3Event, Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import csv = require('csv-parser');
import { Readable } from 'stream';

const s3Client = new S3Client({});

export const handler: Handler<S3Event> = async (event) => {
  try {
    const record = event.Records[0];
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

    const results: any[] = [];

    await new Promise((resolve, reject) => {
      Body.pipe(csv())
        .on('data', (data: any) => {
          console.log('Parsed CSV row:', JSON.stringify(data));
          results.push(data);
        })
        .on('end', async () => {
          try {
            // Move file to parsed folder
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

            console.log('File processed and moved successfully');
            resolve(true);
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'CSV processing completed',
        records: results.length,
      }),
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
