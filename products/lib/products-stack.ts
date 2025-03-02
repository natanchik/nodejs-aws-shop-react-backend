import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';

export class ProductsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsTable = dynamodb.Table.fromTableName(this, 'ImportedProductsTable', 'products');
    const stocksTable = dynamodb.Table.fromTableName(this, 'ImportedStocksTable', 'stocks');

    const getProductsList = new lambda.Function(this, 'GetProductsListHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'getProductsList.handler',
      timeout: cdk.Duration.seconds(30),
      initialPolicy: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['dynamodb:Scan', 'dynamodb:GetItem'],
          resources: [productsTable.tableArn, stocksTable.tableArn],
        }),
      ],
    });

    const getProductById = new lambda.Function(this, 'GetProductByIdHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'getProductById.handler',
      timeout: cdk.Duration.seconds(30),
      initialPolicy: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['dynamodb:Scan', 'dynamodb:GetItem'],
          resources: [productsTable.tableArn, stocksTable.tableArn],
        }),
      ],
    });

    productsTable.grantReadData(getProductsList);
    stocksTable.grantReadData(getProductsList);
    productsTable.grantReadData(getProductById);
    stocksTable.grantReadData(getProductById);

    const api = new apigateway.RestApi(this, 'ProductServiceApi', {
      restApiName: 'Product Service API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const products = api.root.addResource('products');

    products.addMethod('GET', new apigateway.LambdaIntegration(getProductsList));

    const product = products.addResource('{productId}');
    product.addMethod('GET', new apigateway.LambdaIntegration(getProductById));

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    const addSwagger = new lambda.Function(this, 'SwaggerHandler', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'swagger.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.seconds(30),
    });

    api.root.addResource('docs').addMethod('GET', new apigateway.LambdaIntegration(addSwagger));
    api.root.addResource('swagger.json').addMethod('GET', new apigateway.LambdaIntegration(addSwagger));
  }
}
