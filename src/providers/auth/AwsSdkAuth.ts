import { AuthProvider, ResolvedCredentials } from './types.js';

export class AwsSdkAuth implements AuthProvider {
  readonly authType = 'awsSdk';

  async resolveCredentials(env: Record<string, string | undefined>): Promise<ResolvedCredentials> {
    const awsAccessKey = env.AWS_ACCESS_KEY_ID;
    const awsSecretKey = env.AWS_SECRET_ACCESS_KEY;
    const awsSessionToken = env.AWS_SESSION_TOKEN;
    const awsRegion = env.AWS_REGION || env.AWS_DEFAULT_REGION;

    if (!awsAccessKey || !awsSecretKey) {
      throw new Error('Missing AWS credentials: AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required');
    }

    return {
      awsAccessKey,
      awsSecretKey,
      awsSessionToken,
      awsRegion,
    };
  }

  buildHeaders(credentials: ResolvedCredentials): Record<string, string> {
    if (!credentials.awsAccessKey || !credentials.awsSecretKey) {
      throw new Error('AWS credentials are required');
    }

    const now = new Date();
    const iso = now.toISOString();
    const dateStamp = `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}`;
    const amzDate = `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;

    const headers: Record<string, string> = {
      'x-amz-date': amzDate,
    };

    if (credentials.awsSessionToken) {
      headers['x-amz-security-token'] = credentials.awsSessionToken;
    }

    const region = credentials.awsRegion || 'us-east-1';
    const credential = `${credentials.awsAccessKey}/${dateStamp}/${region}/aws4_request`;

    headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${credential}, SignedHeaders=x-amz-date, Signature=placeholder`;

    return headers;
  }

  buildRequestInit(credentials: ResolvedCredentials): RequestInit {
    return {
      headers: this.buildHeaders(credentials),
    };
  }
}
