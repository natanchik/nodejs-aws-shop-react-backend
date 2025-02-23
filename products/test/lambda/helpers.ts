import { Context, Callback, APIGatewayProxyResult } from 'aws-lambda';

export const createMockContext = (): Context => ({
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:region:account:function:test-function',
  memoryLimitInMB: '128',
  awsRequestId: '123456',
  logGroupName: '/aws/lambda/test-function',
  logStreamName: '2023/01/01/[$LATEST]123456',
  getRemainingTimeInMillis: () => 1000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
});

export const createMockCallback: Callback<APIGatewayProxyResult> = (error, result) => {
  if (result) return result;
  return error;
};
