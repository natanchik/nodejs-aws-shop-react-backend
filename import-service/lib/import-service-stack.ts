import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { Construct } from 'constructs';

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

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

    // Authorizer
    const basicAuthorizer = lambda.Function.fromFunctionArn(
      this,
      'BasicAuthorizer',
      'arn:aws:lambda:eu-north-1:851725621121:function:AuthorizationServiceStack-BasicAuthorizerHandlerD8-oEnlhFg0sbZc',
    );

    const authorizer = new apigateway.TokenAuthorizer(this, 'ImportAuthorizer', {
      handler: basicAuthorizer,
      identitySource: apigateway.IdentitySource.header('Authorization'),
      resultsCacheTtl: cdk.Duration.seconds(0),
    });

    const importFileParser = new lambda.Function(this, 'ImportFileParser', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'importFileParser.handler',
      code: lambda.Code.fromAsset('lambda'),
      environment: {
        BUCKET_NAME: importBucket.bucketName,
      },
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
    });

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
        allowHeaders: ['*'],
      },
    });

    const importResource = api.root.addResource('import');

    importResource.addMethod('GET', new apigateway.LambdaIntegration(importProductsFile), {
      authorizer: authorizer,
      authorizationType: apigateway.AuthorizationType.CUSTOM,
      requestParameters: {
        'method.request.querystring.name': true,
      },
    });
  }
}
