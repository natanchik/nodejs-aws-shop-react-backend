import { S3Event, Handler } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
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

    if (Body instanceof Readable) {
      await new Promise((resolve, reject) => {
        Body.pipe(csv())
          .on('data', (data) => {
            console.log('Parsed CSV row:', JSON.stringify(data));
          })
          .on('error', (error) => {
            console.error('Error parsing CSV:', error);
            reject(error);
          })
          .on('end', () => {
            console.log('Finished processing CSV file');
            resolve(null);
          });
      });
    }

    return {
      statusCode: 200,
      body: 'CSV processing completed',
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
