import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';
import { logger } from '../logger.js';

export class ZavorthCloudStorageTool extends BaseTool {
  public readonly name = 'zavorth_cloud_storage';

  public readonly description =
    'Cloud storage operations — S3, Google Cloud Storage, and Azure Blob Storage. Upload, download, list, delete, copy, presign URLs, sync, and bucket management.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'list', 'upload', 'download', 'delete', 'copy', 'move', 'presign', 'sync', 'info', 'create_bucket', 'delete_bucket', 'set_policy', 'set_cors'.",
      },
      provider: {
        type: 'string',
        description: "Cloud provider: 's3', 'gcs', 'azure'. Default: 's3'.",
      },
      bucket: {
        type: 'string',
        description: 'Bucket or container name.',
      },
      key: {
        type: 'string',
        description: 'Object key/path in the bucket.',
      },
      local_path: {
        type: 'string',
        description: 'Local file path for upload/download.',
      },
      destination: {
        type: 'string',
        description: 'Destination key for copy/move operations.',
      },
      region: {
        type: 'string',
        description: 'AWS region. Default: us-east-1.',
      },
      prefix: {
        type: 'string',
        description: 'Prefix filter for listing objects.',
      },
      max_results: {
        type: 'number',
        description: 'Max results for list operations. Default: 100.',
      },
      expiration_hours: {
        type: 'number',
        description: 'Presigned URL expiration in hours. Default: 1.',
      },
      content_type: {
        type: 'string',
        description: 'Content type for uploads.',
      },
      acl: {
        type: 'string',
        description: "Access control: 'private', 'public-read', 'public-read-write'.",
      },
      recursive: {
        type: 'boolean',
        description: 'Recursive sync. Default: true.',
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    const provider = String(args.provider || 's3');

    switch (action) {
      case 'list': return await this.list(args, provider);
      case 'upload': return await this.upload(args, provider);
      case 'download': return await this.download(args, provider);
      case 'delete': return await this.deleteObject(args, provider);
      case 'copy': return await this.copyObject(args, provider);
      case 'move': return await this.moveObject(args, provider);
      case 'presign': return await this.presign(args, provider);
      case 'sync': return await this.sync(args, provider);
      case 'info': return await this.info(args, provider);
      case 'create_bucket': return await this.createBucket(args, provider);
      case 'delete_bucket': return await this.deleteBucket(args, provider);
      case 'set_policy': return await this.setPolicy(args, provider);
      case 'set_cors': return await this.setCors(args, provider);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async runCmd(cmd: string, cmdArgs: string[], timeout = 60000): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync(cmd, cmdArgs, {
        timeout,
        maxBuffer: 50 * 1024 * 1024,
      }).toString();
      return result.trim();
    } catch (error: unknown) {logger.warn('[Zavorth Cloud Storage] process execution failed', error); return ''; }
  }

  private buildS3Uri(bucket: string, key: string): string {
    return `s3://${bucket}/${key}`;
  }

  private buildGcsUri(bucket: string, key: string): string {
    return `gs://${bucket}/${key}`;
  }

  private async list(args: Record<string, unknown>, provider: string): Promise<string> {
    const bucket = String(args.bucket || '');
    if (!bucket) return 'Error: "bucket" is required.';

    const prefix = String(args.prefix || '');
    const maxResults = Number(args.max_results || 100);

    switch (provider) {
      case 's3': {
        const cmdArgs = ['s3', 'ls', `s3://${bucket}/${prefix}`, '--recursive', '--page-size', String(maxResults)];
        return `S3 listing:\n${await this.runCmd('aws', cmdArgs)}`;
      }
      case 'gcs': {
        const cmdArgs = ['ls', '-r', `gs://${bucket}/${prefix}*`];
        if (maxResults) cmdArgs.push('--limit', String(maxResults));
        return `GCS listing:\n${await this.runCmd('gsutil', cmdArgs)}`;
      }
      case 'azure': {
        const cmdArgs = ['storage', 'blob', 'list', '--container-name', bucket, '--prefix', prefix, '--num-results', String(maxResults), '--output', 'table'];
        return `Azure listing:\n${await this.runCmd('az', cmdArgs)}`;
      }
      default:
        return `Error: Provider "${provider}" not supported.`;
    }
  }

  private async upload(args: Record<string, unknown>, provider: string): Promise<string> {
    const bucket = String(args.bucket || '');
    const key = String(args.key || '');
    const localPath = String(args.local_path || '');
    if (!bucket || !localPath) return 'Error: "bucket" and "local_path" are required.';

    if (!fs.existsSync(localPath)) return `Error: Local file ${localPath} not found.`;

    const destKey = key || path.basename(localPath);

    switch (provider) {
      case 's3': {
        const cmdArgs = ['s3', 'cp', localPath, this.buildS3Uri(bucket, destKey)];
        if (args.content_type) cmdArgs.push('--content-type', String(args.content_type));
        if (args.acl) cmdArgs.push('--acl', String(args.acl));
        return `S3 upload:\n${await this.runCmd('aws', cmdArgs)}`;
      }
      case 'gcs': {
        const cmdArgs = ['cp', localPath, this.buildGcsUri(bucket, destKey)];
        if (args.content_type) cmdArgs.push('-h', `Content-Type:${args.content_type}`);
        return `GCS upload:\n${await this.runCmd('gsutil', cmdArgs)}`;
      }
      case 'azure': {
        const cmdArgs = ['storage', 'blob', 'upload', '--container-name', bucket, '--name', destKey, '--file', localPath];
        if (args.content_type) cmdArgs.push('--content-type', String(args.content_type));
        return `Azure upload:\n${await this.runCmd('az', cmdArgs)}`;
      }
      default:
        return `Error: Provider "${provider}" not supported.`;
    }
  }

  private async download(args: Record<string, unknown>, provider: string): Promise<string> {
    const bucket = String(args.bucket || '');
    const key = String(args.key || '');
    const localPath = String(args.local_path || path.basename(key));
    if (!bucket || !key) return 'Error: "bucket" and "key" are required.';

    switch (provider) {
      case 's3':
        return `S3 download:\n${await this.runCmd('aws', ['s3', 'cp', this.buildS3Uri(bucket, key), localPath])}`;
      case 'gcs':
        return `GCS download:\n${await this.runCmd('gsutil', ['cp', this.buildGcsUri(bucket, key), localPath])}`;
      case 'azure': {
        const cmdArgs = ['storage', 'blob', 'download', '--container-name', bucket, '--name', key, '--file', localPath];
        return `Azure download:\n${await this.runCmd('az', cmdArgs)}`;
      }
      default:
        return `Error: Provider "${provider}" not supported.`;
    }
  }

  private async deleteObject(args: Record<string, unknown>, provider: string): Promise<string> {
    const bucket = String(args.bucket || '');
    const key = String(args.key || '');
    if (!bucket || !key) return 'Error: "bucket" and "key" are required.';

    switch (provider) {
      case 's3':
        return `S3 delete:\n${await this.runCmd('aws', ['s3', 'rm', this.buildS3Uri(bucket, key)])}`;
      case 'gcs':
        return `GCS delete:\n${await this.runCmd('gsutil', ['rm', this.buildGcsUri(bucket, key)])}`;
      case 'azure': {
        const cmdArgs = ['storage', 'blob', 'delete', '--container-name', bucket, '--name', key];
        return `Azure delete:\n${await this.runCmd('az', cmdArgs)}`;
      }
      default:
        return `Error: Provider "${provider}" not supported.`;
    }
  }

  private async copyObject(args: Record<string, unknown>, provider: string): Promise<string> {
    const bucket = String(args.bucket || '');
    const key = String(args.key || '');
    const destination = String(args.destination || '');
    if (!bucket || !key || !destination) return 'Error: "bucket", "key", and "destination" are required.';

    switch (provider) {
      case 's3':
        return `S3 copy:\n${await this.runCmd('aws', ['s3', 'cp', this.buildS3Uri(bucket, key), this.buildS3Uri(bucket, destination)])}`;
      case 'gcs':
        return `GCS copy:\n${await this.runCmd('gsutil', ['cp', this.buildGcsUri(bucket, key), this.buildGcsUri(bucket, destination)])}`;
      default:
        return `Error: Provider "${provider}" not supported for copy.`;
    }
  }

  private async moveObject(args: Record<string, unknown>, provider: string): Promise<string> {
    const bucket = String(args.bucket || '');
    const key = String(args.key || '');
    const destination = String(args.destination || '');
    if (!bucket || !key || !destination) return 'Error: "bucket", "key", and "destination" are required.';

    switch (provider) {
      case 's3':
        return `S3 move:\n${await this.runCmd('aws', ['s3', 'mv', this.buildS3Uri(bucket, key), this.buildS3Uri(bucket, destination)])}`;
      case 'gcs':
        return `GCS move:\n${await this.runCmd('gsutil', ['mv', this.buildGcsUri(bucket, key), this.buildGcsUri(bucket, destination)])}`;
      default:
        return `Error: Provider "${provider}" not supported for move.`;
    }
  }

  private async presign(args: Record<string, unknown>, provider: string): Promise<string> {
    const bucket = String(args.bucket || '');
    const key = String(args.key || '');
    if (!bucket || !key) return 'Error: "bucket" and "key" are required.';

    const expiration = Number(args.expiration_hours || 1) * 3600;

    switch (provider) {
      case 's3': {
        const result = await this.runCmd('aws', ['s3', 'presign', this.buildS3Uri(bucket, key), '--expires-in', String(expiration)]);
        return `Presigned URL (expires in ${args.expiration_hours || 1}h):\n${result}`;
      }
      case 'gcs': {
        const result = await this.runCmd('gsutil', ['signurl', '-d', `${args.expiration_hours || 1}h`, this.buildGcsUri(bucket, key)]);
        return `Presigned URL:\n${result}`;
      }
      default:
        return `Error: Presign not supported for "${provider}".`;
    }
  }

  private async sync(args: Record<string, unknown>, provider: string): Promise<string> {
    const bucket = String(args.bucket || '');
    const localPath = String(args.local_path || '');
    const key = String(args.key || '');
    if (!bucket || !localPath) return 'Error: "bucket" and "local_path" are required.';

    switch (provider) {
      case 's3': {
        const dest = key ? this.buildS3Uri(bucket, key) : `s3://${bucket}/`;
        return `S3 sync:\n${await this.runCmd('aws', ['s3', 'sync', localPath, dest])}`;
      }
      case 'gcs': {
        const dest = key ? this.buildGcsUri(bucket, key) : `gs://${bucket}/`;
        return `GCS sync:\n${await this.runCmd('gsutil', ['-m', 'rsync', '-r', localPath, dest])}`;
      }
      default:
        return `Error: Sync not supported for "${provider}".`;
    }
  }

  private async info(args: Record<string, unknown>, provider: string): Promise<string> {
    const bucket = String(args.bucket || '');
    const key = String(args.key || '');
    if (!bucket) return 'Error: "bucket" is required.';

    switch (provider) {
      case 's3': {
        if (key) {
          const result = await this.runCmd('aws', ['s3api', 'head-object', '--bucket', bucket, '--key', key]);
          return `S3 object info:\n${result}`;
        }
        const result = await this.runCmd('aws', ['s3api', 'head-bucket', '--bucket', bucket]);
        return `S3 bucket "${bucket}" exists.`;
      }
      case 'gcs': {
        const result = await this.runCmd('gsutil', ['stat', this.buildGcsUri(bucket, key || '*')]);
        return `GCS info:\n${result}`;
      }
      default:
        return `Error: Info not supported for "${provider}".`;
    }
  }

  private async createBucket(args: Record<string, unknown>, provider: string): Promise<string> {
    const bucket = String(args.bucket || '');
    if (!bucket) return 'Error: "bucket" is required.';

    switch (provider) {
      case 's3': {
        const cmdArgs = ['s3api', 'create-bucket', '--bucket', bucket];
        const region = String(args.region || 'us-east-1');
        if (region !== 'us-east-1') {
          cmdArgs.push('--create-bucket-configuration', `LocationConstraint=${region}`);
        }
        return `S3 create bucket:\n${await this.runCmd('aws', cmdArgs)}`;
      }
      case 'gcs':
        return `GCS create bucket:\n${await this.runCmd('gsutil', ['mb', `gs://${bucket}/`])}`;
      case 'azure':
        return `Azure create container:\n${await this.runCmd('az', ['storage', 'container', 'create', '--name', bucket])}`;
      default:
        return `Error: Provider "${provider}" not supported.`;
    }
  }

  private async deleteBucket(args: Record<string, unknown>, provider: string): Promise<string> {
    const bucket = String(args.bucket || '');
    if (!bucket) return 'Error: "bucket" is required.';

    switch (provider) {
      case 's3':
        return `S3 delete bucket:\n${await this.runCmd('aws', ['s3', 'rb', `s3://${bucket}`, '--force'])}`;
      case 'gcs':
        return `GCS delete bucket:\n${await this.runCmd('gsutil', ['rb', `gs://${bucket}`])}`;
      case 'azure':
        return `Azure delete container:\n${await this.runCmd('az', ['storage', 'container', 'delete', '--name', bucket])}`;
      default:
        return `Error: Provider "${provider}" not supported.`;
    }
  }

  private async setPolicy(args: Record<string, unknown>, provider: string): Promise<string> {
    const bucket = String(args.bucket || '');
    if (!bucket) return 'Error: "bucket" is required.';

    switch (provider) {
      case 's3':
        return `S3 set policy — use "aws s3api put-bucket-policy --bucket ${bucket} --policy file://policy.json"`;
      case 'gcs':
        return `GCS set policy — use "gsutil iam set policy.json gs://${bucket}"`;
      default:
        return `Error: Policy not supported for "${provider}".`;
    }
  }

  private async setCors(args: Record<string, unknown>, provider: string): Promise<string> {
    const bucket = String(args.bucket || '');
    if (!bucket) return 'Error: "bucket" is required.';

    switch (provider) {
      case 's3':
        return `S3 set CORS — use "aws s3api put-bucket-cors --bucket ${bucket} --cors-configuration file://cors.json"`;
      case 'gcs':
        return `GCS set CORS — use "gsutil cors set cors.json gs://${bucket}"`;
      default:
        return `Error: CORS not supported for "${provider}".`;
    }
  }
}
