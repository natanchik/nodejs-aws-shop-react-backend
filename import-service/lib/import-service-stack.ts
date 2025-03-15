import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const catalogItemsQueue = sqs.Queue.fromQueueArn(
      this,
      'CatalogItemsQueue',
      `arn:aws:sqs:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:catalogItemsQueue`,
    );

    const importBucket = s3.Bucket.fromBucketName(
      this,
      'ImportBucket',
      'rss-nodejs-aws-shop-react-backend-import-service',
    );

    const importProductsFile = new lambda.Function(this, 'ImportProductsFile', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'importProductsFile.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: {
        BUCKET_NAME: importBucket.bucketName,
        UPLOADED_FOLDER: 'uploaded',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
    });

    const importFileParser = new lambda.Function(this, 'ImportFileParser', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'importFileParser.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: {
        BUCKET_NAME: importBucket.bucketName,
        SQS_URL: catalogItemsQueue.queueUrl,
      },
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
    });

    catalogItemsQueue.grantSendMessages(importFileParser);

    const bucketPolicy = new s3.BucketPolicy(this, 'ImportServiceBucketPolicy', {
      bucket: importBucket,
    });

    bucketPolicy.document.addStatements(
      new iam.PolicyStatement({
        sid: 'Statement1',
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.ServicePrincipal('lambda.amazonaws.com'),
          new iam.ArnPrincipal(importProductsFile.role?.roleArn || ''),
        ],
        actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
        resources: [importBucket.bucketArn, `${importBucket.bucketArn}/*`],
      }),
    );

    // Add S3 notification for the uploaded folder
    importBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.LambdaDestination(importFileParser), {
      prefix: 'uploaded/', // Only trigger for objects in the uploaded folder
    });

    importBucket.grantRead(importFileParser);
    importBucket.grantReadWrite(importProductsFile);

    const api = new apigateway.RestApi(this, 'ImportApi', {
      restApiName: 'Import Service',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const importResource = api.root.addResource('import');
    importResource.addMethod('GET', new apigateway.LambdaIntegration(importProductsFile), {
      requestParameters: {
        'method.request.querystring.name': true,
      },
    });
  }
}
