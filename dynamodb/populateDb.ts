import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config();

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'eu-north-1',
});

const docClient = DynamoDBDocumentClient.from(client);

const products = [
  {
    title: 'iPhone 13',
    description: 'Latest iPhone model with A15 Bionic chip',
    price: 999,
  },
  {
    title: 'MacBook Pro',
    description: 'Professional laptop with M1 chip',
    price: 1299,
  },
  {
    title: 'iPad Air',
    description: 'Lightweight tablet for creativity',
    price: 599,
  },
];

async function populateTables() {
  try {
    for (const product of products) {
      const productId = uuidv4();

      console.log(`Creating product: ${product.title}...`);

      await docClient.send(
        new PutCommand({
          TableName: 'products',
          Item: {
            id: productId,
            title: product.title,
            description: product.description,
            price: product.price,
          },
        }),
      );

      console.log(`Creating stock for product: ${product.title}...`);

      await docClient.send(
        new PutCommand({
          TableName: 'stocks',
          Item: {
            product_id: productId,
            count: Math.floor(Math.random() * 100) + 1,
          },
        }),
      );

      console.log(`Successfully created product and stock for: ${product.title}`);
    }

    console.log('Database population completed successfully!');
  } catch (error) {
    console.error('Error populating database:', error);
  }
}

populateTables();
