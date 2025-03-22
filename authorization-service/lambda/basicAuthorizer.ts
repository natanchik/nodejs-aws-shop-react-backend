import { APIGatewayTokenAuthorizerEvent, APIGatewayAuthorizerResult } from 'aws-lambda';

export const handler = async (event: APIGatewayTokenAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  console.log('Event:', JSON.stringify(event));

  if (!event.authorizationToken) {
    throw new Error('Unauthorized'); // Return 401
  }

  try {
    const token = event.authorizationToken.replace('Basic ', '');
    const credentials = Buffer.from(token, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    console.log(`Username: ${username}`);

    const storedPassword = process.env[username];
    const effect = storedPassword && storedPassword === password ? 'Allow' : 'Deny';

    if (effect === 'Deny') {
      throw new Error('Forbidden'); // Return 403
    }

    return {
      principalId: username,
      policyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'execute-api:Invoke',
            Effect: effect,
            Resource: event.methodArn,
          },
        ],
      },
    };
  } catch (error) {
    throw new Error('Forbidden'); // Return 403
  }
};
