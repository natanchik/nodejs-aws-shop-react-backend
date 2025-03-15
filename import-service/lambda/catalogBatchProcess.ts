import { SQSEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { v4 as uuidv4 } from 'uuid';

const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const snsClient = new SNSClient({});

export const handler = async (event: SQSEvent) => {
  try {
    const products = event.Records.map((record) => JSON.parse(record.body));
    const createdProducts = [];

    for (const product of products) {
      const productId = uuidv4();
      const productItem = {
        id: productId,
        title: product.title,
        description: product.description,
        price: Number(product.price),
      };

      // Create product in DynamoDB
      await docClient.send(
        new PutCommand({
          TableName: process.env.PRODUCTS_TABLE,
          Item: productItem,
        }),
      );

      // Create stock record
      await docClient.send(
        new PutCommand({
          TableName: process.env.STOCKS_TABLE,
          Item: {
            product_id: productId,
            count: Number(product.count) || 0,
          },
        }),
      );

      createdProducts.push(productItem);
    }

    // Send notification to SNS
    await snsClient.send(
      new PublishCommand({
        TopicArn: process.env.SNS_TOPIC_ARN,
        Subject: 'Products Created',
        Message: JSON.stringify({
          message: `Successfully created ${createdProducts.length} products`,
          products: createdProducts,
        }),
        MessageAttributes: {
          price: {
            DataType: 'Number',
            StringValue: createdProducts[0].price.toString(),
          },
        },
      }),
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Products created successfully' }),
    };
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
};
