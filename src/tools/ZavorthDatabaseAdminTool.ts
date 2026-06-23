import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

export class ZavorthDatabaseAdminTool extends BaseTool {
  public readonly name = 'zavorth_database_admin';

  public readonly description =
    'Database administration — execute queries, inspect schemas, backup/restore, migrate, manage indexes, analyze performance, and manage database connections for PostgreSQL, MySQL, SQLite, and MongoDB.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'query', 'schema', 'backup', 'restore', 'migrate', 'indexes', 'explain', 'tables', 'databases', 'users', 'create_db', 'drop_db', 'vacuum', 'status'.",
      },
      db_type: {
        type: 'string',
        description: "Database type: 'postgres', 'mysql', 'sqlite', 'mongodb'. Default: 'postgres'.",
      },
      connection_string: {
        type: 'string',
        description: 'Database connection string.',
      },
      host: {
        type: 'string',
        description: 'Database host. Default: localhost.',
      },
      port: {
        type: 'number',
        description: 'Database port.',
      },
      database: {
        type: 'string',
        description: 'Database name.',
      },
      user: {
        type: 'string',
        description: 'Database user.',
      },
      password: {
        type: 'string',
        description: 'Database password.',
      },
      query: {
        type: 'string',
        description: 'SQL or NoSQL query to execute.',
      },
      table: {
        type: 'string',
        description: 'Table name for schema/index operations.',
      },
      output_path: {
        type: 'string',
        description: 'File path for backup/restore operations.',
      },
      migration_name: {
        type: 'string',
        description: 'Migration name.',
      },
      limit: {
        type: 'number',
        description: 'Row limit for query results. Default: 100.',
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'query': return await this.executeQuery(args);
      case 'schema': return await this.getSchema(args);
      case 'backup': return await this.backup(args);
      case 'restore': return await this.restore(args);
      case 'migrate': return await this.migrate(args);
      case 'indexes': return await this.indexes(args);
      case 'explain': return await this.explain(args);
      case 'tables': return await this.tables(args);
      case 'databases': return await this.databases(args);
      case 'users': return await this.users(args);
      case 'create_db': return await this.createDb(args);
      case 'drop_db': return await this.dropDb(args);
      case 'vacuum': return await this.vacuum(args);
      case 'status': return await this.status(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async runCmd(cmd: string, cmdArgs: string[], timeout = 30000): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync(cmd, cmdArgs, {
        timeout,
        maxBuffer: 50 * 1024 * 1024,
      }).toString();
      return result.trim();
    } catch (error: unknown) {
      return `Command error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private getDbArgs(args: Record<string, unknown>): string[] {
    const dbArgs: string[] = [];
    const host = String(args.host || 'localhost');
    const port = args.port ? String(args.port) : '';
    const database = String(args.database || '');
    const user = String(args.user || '');

    if (host) dbArgs.push('-h', host);
    if (port) dbArgs.push('-p', port);
    if (database) dbArgs.push('-d', database);
    if (user) dbArgs.push('-U', user);

    return dbArgs;
  }

  private async executeQuery(args: Record<string, unknown>): Promise<string> {
    const dbType = String(args.db_type || 'postgres');
    const query = String(args.query || '');
    if (!query) return 'Error: "query" is required.';

    const limit = Number(args.limit || 100);

    switch (dbType) {
      case 'postgres': {
        const dbArgs = this.getDbArgs(args);
        const limitedQuery = query.toLowerCase().includes('limit') ? query : `${query} LIMIT ${limit}`;
        dbArgs.push('-c', limitedQuery, '-t', '-A');
        return `Query result:\n${await this.runCmd('psql', dbArgs)}`;
      }
      case 'mysql': {
        const host = String(args.host || 'localhost');
        const database = String(args.database || '');
        const user = String(args.user || 'root');
        const mysqlArgs = [`-h${host}`, `-u${user}`];
        if (args.password) mysqlArgs.push(`-p${String(args.password)}`);
        if (database) mysqlArgs.push(database);
        mysqlArgs.push('-e', query);
        return `Query result:\n${await this.runCmd('mysql', mysqlArgs)}`;
      }
      case 'sqlite': {
        const database = String(args.database || '');
        if (!database) return 'Error: "database" (file path) is required for SQLite.';
        return `Query result:\n${await this.runCmd('sqlite3', [database, query])}`;
      }
      case 'mongodb': {
        const database = String(args.database || 'test');
        const host = String(args.host || 'localhost');
        const port = args.port ? String(args.port) : '27017';
        const uri = `mongodb://${host}:${port}/${database}`;
        return `Query result:\n${await this.runCmd('mongosh', [uri, '--eval', query, '--quiet'])}`;
      }
      default:
        return `Error: Database type "${dbType}" not supported.`;
    }
  }

  private async getSchema(args: Record<string, unknown>): Promise<string> {
    const dbType = String(args.db_type || 'postgres');
    const database = String(args.database || '');
    const table = String(args.table || '');

    switch (dbType) {
      case 'postgres': {
        const query = table
          ? `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position;`
          : `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;`;
        const dbArgs = this.getDbArgs(args);
        dbArgs.push('-c', query, '-t', '-A');
        return `Schema:\n${await this.runCmd('psql', dbArgs)}`;
      }
      case 'mysql': {
        const host = String(args.host || 'localhost');
        const user = String(args.user || 'root');
        const mysqlArgs = [`-h${host}`, `-u${user}`];
        if (args.password) mysqlArgs.push(`-p${String(args.password)}`);
        if (database) mysqlArgs.push(database);
        mysqlArgs.push('-e', table ? `DESCRIBE ${table}` : `SHOW TABLES;`);
        return `Schema:\n${await this.runCmd('mysql', mysqlArgs)}`;
      }
      case 'sqlite': {
        if (!database) return 'Error: "database" is required for SQLite.';
        const cmd = table ? `.schema ${table}` : `.schema`;
        return `Schema:\n${await this.runCmd('sqlite3', [database, cmd])}`;
      }
      default:
        return `Error: Schema inspection not supported for "${dbType}".`;
    }
  }

  private async backup(args: Record<string, unknown>): Promise<string> {
    const dbType = String(args.db_type || 'postgres');
    const database = String(args.database || '');
    const outputPath = String(args.output_path || `backup_${Date.now()}.sql`);

    switch (dbType) {
      case 'postgres': {
        const dbArgs = this.getDbArgs(args);
        const dumpArgs = ['-f', outputPath];
        if (database) dumpArgs.push(database);
        return `Backup:\n${await this.runCmd('pg_dump', [...dumpArgs, ...dbArgs.filter((_, i) => i % 2 === 0 ? false : true)])}`;
      }
      case 'mysql': {
        const host = String(args.host || 'localhost');
        const user = String(args.user || 'root');
        const dumpArgs = [`-h${host}`, `-u${user}`, '--result-file', outputPath];
        if (args.password) dumpArgs.push(`-p${String(args.password)}`);
        if (database) dumpArgs.push(database);
        return `Backup:\n${await this.runCmd('mysqldump', dumpArgs)}`;
      }
      case 'sqlite': {
        if (!database) return 'Error: "database" is required.';
        return `Backup:\n${await this.runCmd('sqlite3', [database, `.backup '${outputPath}'`])}`;
      }
      default:
        return `Error: Backup not supported for "${dbType}".`;
    }
  }

  private async restore(args: Record<string, unknown>): Promise<string> {
    const dbType = String(args.db_type || 'postgres');
    const database = String(args.database || '');
    const inputPath = String(args.output_path || '');

    if (!inputPath) return 'Error: "output_path" (backup file) is required.';

    switch (dbType) {
      case 'postgres': {
        const dbArgs = this.getDbArgs(args);
        return `Restore:\n${await this.runCmd('psql', [...dbArgs, '-f', inputPath])}`;
      }
      case 'mysql': {
        const host = String(args.host || 'localhost');
        const user = String(args.user || 'root');
        const mysqlArgs = [`-h${host}`, `-u${user}`];
        if (args.password) mysqlArgs.push(`-p${String(args.password)}`);
        if (database) mysqlArgs.push(database);
        mysqlArgs.push('-e', `source ${inputPath}`);
        return `Restore:\n${await this.runCmd('mysql', mysqlArgs)}`;
      }
      case 'sqlite': {
        if (!database) return 'Error: "database" is required.';
        return `Restore:\n${await this.runCmd('sqlite3', [database, `.restore '${inputPath}'`])}`;
      }
      default:
        return `Error: Restore not supported for "${dbType}".`;
    }
  }

  private async migrate(args: Record<string, unknown>): Promise<string> {
    const migrationName = String(args.migration_name || '');
    if (!migrationName) return 'Error: "migration_name" is required.';

    try {
      const { execFileSync } = await import('child_process');

      if (fs.existsSync('knexfile.ts') || fs.existsSync('knexfile.js')) {
        return `Migration:\n${await this.runCmd('npx', ['knex', 'migrate:latest'])}`;
      }
      if (fs.existsSync('prisma')) {
        return `Migration:\n${await this.runCmd('npx', ['prisma', 'migrate', 'dev', '--name', migrationName])}`;
      }
      if (fs.existsSync('drizzle.config.ts')) {
        return `Migration:\n${await this.runCmd('npx', ['drizzle-kit', 'generate'])}`;
      }

      return 'Error: No migration framework detected (tried Knex, Prisma, Drizzle).';
    } catch (error: unknown) {
      return `Migration error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async indexes(args: Record<string, unknown>): Promise<string> {
    const dbType = String(args.db_type || 'postgres');
    const database = String(args.database || '');
    const table = String(args.table || '');

    switch (dbType) {
      case 'postgres': {
        const query = table
          ? `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = '${table}';`
          : `SELECT tablename, indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;`;
        const dbArgs = this.getDbArgs(args);
        dbArgs.push('-c', query, '-t', '-A');
        return `Indexes:\n${await this.runCmd('psql', dbArgs)}`;
      }
      case 'mysql': {
        const host = String(args.host || 'localhost');
        const user = String(args.user || 'root');
        const mysqlArgs = [`-h${host}`, `-u${user}`];
        if (args.password) mysqlArgs.push(`-p${String(args.password)}`);
        if (database) mysqlArgs.push(database);
        mysqlArgs.push('-e', table ? `SHOW INDEX FROM ${table}` : `SELECT TABLE_NAME, INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = '${database}';`);
        return `Indexes:\n${await this.runCmd('mysql', mysqlArgs)}`;
      }
      default:
        return `Error: Index inspection not supported for "${dbType}".`;
    }
  }

  private async explain(args: Record<string, unknown>): Promise<string> {
    const dbType = String(args.db_type || 'postgres');
    const query = String(args.query || '');
    if (!query) return 'Error: "query" is required for explain.';

    switch (dbType) {
      case 'postgres': {
        const dbArgs = this.getDbArgs(args);
        dbArgs.push('-c', `EXPLAIN ANALYZE ${query}`, '-t', '-A');
        return `Query plan:\n${await this.runCmd('psql', dbArgs)}`;
      }
      case 'mysql': {
        const host = String(args.host || 'localhost');
        const user = String(args.user || 'root');
        const mysqlArgs = [`-h${host}`, `-u${user}`];
        if (args.password) mysqlArgs.push(`-p${String(args.password)}`);
        if (args.database) mysqlArgs.push(String(args.database));
        mysqlArgs.push('-e', `EXPLAIN ${query}`);
        return `Query plan:\n${await this.runCmd('mysql', mysqlArgs)}`;
      }
      default:
        return `Error: Explain not supported for "${dbType}".`;
    }
  }

  private async tables(args: Record<string, unknown>): Promise<string> {
    const dbType = String(args.db_type || 'postgres');
    const database = String(args.database || '');

    switch (dbType) {
      case 'postgres': {
        const dbArgs = this.getDbArgs(args);
        dbArgs.push('-c', "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;", '-t', '-A');
        return `Tables:\n${await this.runCmd('psql', dbArgs)}`;
      }
      case 'mysql': {
        const host = String(args.host || 'localhost');
        const user = String(args.user || 'root');
        const mysqlArgs = [`-h${host}`, `-u${user}`];
        if (args.password) mysqlArgs.push(`-p${String(args.password)}`);
        if (database) mysqlArgs.push(database);
        mysqlArgs.push('-e', 'SHOW TABLES;');
        return `Tables:\n${await this.runCmd('mysql', mysqlArgs)}`;
      }
      case 'sqlite': {
        if (!database) return 'Error: "database" is required.';
        return `Tables:\n${await this.runCmd('sqlite3', [database, '.tables'])}`;
      }
      default:
        return `Error: Not supported for "${dbType}".`;
    }
  }

  private async databases(args: Record<string, unknown>): Promise<string> {
    const dbType = String(args.db_type || 'postgres');

    switch (dbType) {
      case 'postgres': {
        const dbArgs = this.getDbArgs(args);
        dbArgs.push('-c', "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;", '-t', '-A');
        return `Databases:\n${await this.runCmd('psql', dbArgs)}`;
      }
      case 'mysql': {
        const host = String(args.host || 'localhost');
        const user = String(args.user || 'root');
        const mysqlArgs = [`-h${host}`, `-u${user}`];
        if (args.password) mysqlArgs.push(`-p${String(args.password)}`);
        mysqlArgs.push('-e', 'SHOW DATABASES;');
        return `Databases:\n${await this.runCmd('mysql', mysqlArgs)}`;
      }
      default:
        return `Error: Not supported for "${dbType}".`;
    }
  }

  private async users(args: Record<string, unknown>): Promise<string> {
    const dbType = String(args.db_type || 'postgres');

    switch (dbType) {
      case 'postgres': {
        const dbArgs = this.getDbArgs(args);
        dbArgs.push('-c', "SELECT usename, usesuper FROM pg_user ORDER BY usename;", '-t', '-A');
        return `Users:\n${await this.runCmd('psql', dbArgs)}`;
      }
      case 'mysql': {
        const host = String(args.host || 'localhost');
        const user = String(args.user || 'root');
        const mysqlArgs = [`-h${host}`, `-u${user}`];
        if (args.password) mysqlArgs.push(`-p${String(args.password)}`);
        mysqlArgs.push('-e', "SELECT User, Host FROM mysql.user ORDER BY User;");
        return `Users:\n${await this.runCmd('mysql', mysqlArgs)}`;
      }
      default:
        return `Error: Not supported for "${dbType}".`;
    }
  }

  private async createDb(args: Record<string, unknown>): Promise<string> {
    const dbType = String(args.db_type || 'postgres');
    const database = String(args.database || '');
    if (!database) return 'Error: "database" is required.';

    switch (dbType) {
      case 'postgres': {
        const dbArgs = this.getDbArgs(args);
        dbArgs.push('-c', `CREATE DATABASE ${database};`);
        return `Create database:\n${await this.runCmd('psql', dbArgs)}`;
      }
      case 'mysql': {
        const host = String(args.host || 'localhost');
        const user = String(args.user || 'root');
        const mysqlArgs = [`-h${host}`, `-u${user}`];
        if (args.password) mysqlArgs.push(`-p${String(args.password)}`);
        mysqlArgs.push('-e', `CREATE DATABASE ${database};`);
        return `Create database:\n${await this.runCmd('mysql', mysqlArgs)}`;
      }
      default:
        return `Error: Not supported for "${dbType}".`;
    }
  }

  private async dropDb(args: Record<string, unknown>): Promise<string> {
    const dbType = String(args.db_type || 'postgres');
    const database = String(args.database || '');
    if (!database) return 'Error: "database" is required.';

    switch (dbType) {
      case 'postgres': {
        const dbArgs = this.getDbArgs(args);
        dbArgs.push('-c', `DROP DATABASE IF EXISTS ${database};`);
        return `Drop database:\n${await this.runCmd('psql', dbArgs)}`;
      }
      case 'mysql': {
        const host = String(args.host || 'localhost');
        const user = String(args.user || 'root');
        const mysqlArgs = [`-h${host}`, `-u${user}`];
        if (args.password) mysqlArgs.push(`-p${String(args.password)}`);
        mysqlArgs.push('-e', `DROP DATABASE IF EXISTS ${database};`);
        return `Drop database:\n${await this.runCmd('mysql', mysqlArgs)}`;
      }
      default:
        return `Error: Not supported for "${dbType}".`;
    }
  }

  private async vacuum(args: Record<string, unknown>): Promise<string> {
    const dbType = String(args.db_type || 'postgres');
    const database = String(args.database || '');

    switch (dbType) {
      case 'postgres': {
        const dbArgs = this.getDbArgs(args);
        dbArgs.push('-c', 'VACUUM ANALYZE;');
        return `Vacuum:\n${await this.runCmd('psql', dbArgs)}`;
      }
      case 'sqlite': {
        if (!database) return 'Error: "database" is required.';
        return `Vacuum:\n${await this.runCmd('sqlite3', [database, 'VACUUM;'])}`;
      }
      default:
        return `Error: Vacuum not supported for "${dbType}".`;
    }
  }

  private async status(args: Record<string, unknown>): Promise<string> {
    const dbType = String(args.db_type || 'postgres');

    switch (dbType) {
      case 'postgres': {
        const dbArgs = this.getDbArgs(args);
        dbArgs.push('-c', "SELECT datname, numbackends, xact_commit, xact_rollback, blks_read, blks_hit FROM pg_stat_database WHERE datname = current_database();", '-t', '-A');
        return `Status:\n${await this.runCmd('psql', dbArgs)}`;
      }
      case 'mysql': {
        const host = String(args.host || 'localhost');
        const user = String(args.user || 'root');
        const mysqlArgs = [`-h${host}`, `-u${user}`];
        if (args.password) mysqlArgs.push(`-p${String(args.password)}`);
        mysqlArgs.push('-e', 'SHOW STATUS;');
        return `Status:\n${await this.runCmd('mysql', mysqlArgs)}`;
      }
      default:
        return `Error: Status not supported for "${dbType}".`;
    }
  }
}
