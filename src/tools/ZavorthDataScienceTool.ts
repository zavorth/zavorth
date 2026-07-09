import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import { logger } from '../logger.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

export class ZavorthDataScienceTool extends BaseTool {
  public readonly name = 'zavorth_data_science';

  public readonly description =
    'Data science operations — pandas DataFrames, descriptive statistics, correlation analysis, regression, data cleaning, aggregation, pivoting, and visualization generation via Python scripts.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'describe', 'correlation', 'regression', 'aggregate', 'pivot', 'clean', 'filter', 'merge', 'sample', 'profile', 'execute'.",
      },
      file_path: {
        type: 'string',
        description: 'Path to CSV, JSON, Parquet, or Excel file.',
      },
      code: {
        type: 'string',
        description: 'Custom Python code to execute (for execute action).',
      },
      columns: {
        type: 'string',
        description: "Comma-separated column names to operate on.",
      },
      group_by: {
        type: 'string',
        description: "Column(s) to group by (comma-separated).",
      },
      agg_function: {
        type: 'string',
        description: "Aggregation function: 'sum', 'mean', 'median', 'count', 'min', 'max', 'std'.",
      },
      x_column: {
        type: 'string',
        description: 'Independent variable column for regression.',
      },
      y_column: {
        type: 'string',
        description: 'Dependent variable column for regression.',
      },
      filter_expr: {
        type: 'string',
        description: "Pandas query expression for filtering (e.g., 'age > 30').",
      },
      output_format: {
        type: 'string',
        description: "Output format: 'text', 'json', 'csv'. Default: 'text'.",
      },
      max_rows: {
        type: 'number',
        description: 'Max rows to display. Default: 50.',
      },
      na_action: {
        type: 'string',
        description: "NA handling: 'drop', 'fill_mean', 'fill_median', 'fill_zero', 'fill_ffill'. Default: 'drop'.",
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'describe': return await this.describe(args);
      case 'correlation': return await this.correlation(args);
      case 'regression': return await this.regression(args);
      case 'aggregate': return await this.aggregate(args);
      case 'pivot': return await this.pivot(args);
      case 'clean': return await this.clean(args);
      case 'filter': return await this.filter(args);
      case 'merge': return await this.merge(args);
      case 'sample': return await this.sample(args);
      case 'profile': return await this.profile(args);
      case 'execute': return await this.executeCode(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async runPython(script: string, timeout = 60000): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('python', ['-c', script], {
        timeout,
        maxBuffer: 50 * 1024 * 1024,
      }).toString();
      return result.trim();
    } catch (error: unknown) {logger.warn('[Zavorth Data Science] process execution failed', error); return ''; }
  }

  private loadScript(filePath: string, additional: string): string {
    const ext = path.extname(filePath).toLowerCase();
    let loader: string;
    switch (ext) {
      case '.csv':
        loader = `df = pd.read_csv('${filePath.replace(/\\/g, '/').replace(/'/g, "\\'")}')`;
        break;
      case '.json':
        loader = `df = pd.read_json('${filePath.replace(/\\/g, '/').replace(/'/g, "\\'")}')`;
        break;
      case '.parquet':
        loader = `df = pd.read_parquet('${filePath.replace(/\\/g, '/').replace(/'/g, "\\'")}')`;
        break;
      case '.xlsx':
      case '.xls':
        loader = `df = pd.read_excel('${filePath.replace(/\\/g, '/').replace(/'/g, "\\'")}')`;
        break;
      default:
        loader = `df = pd.read_csv('${filePath.replace(/\\/g, '/').replace(/'/g, "\\'")}')`;
    }

    return `import pandas as pd
import numpy as np
import json
${loader}
${additional}`;
  }

  private async describe(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    if (!filePath) return 'Error: "file_path" is required.';

    const maxRows = Number(args.max_rows || 50);
    const script = this.loadScript(filePath, `
desc = df.describe(include='all').to_string(max_rows=${maxRows})
print(f"Shape: {df.shape}")
print(f"Columns: {list(df.columns)}")
print(f"Dtypes:\\n{df.dtypes.to_string()}")
print(f"\\nDescription:\\n{desc}")
print(f"\\nNull counts:\\n{df.isnull().sum().to_string()}")
`);
    return `Data description:\n${await this.runPython(script)}`;
  }

  private async correlation(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    if (!filePath) return 'Error: "file_path" is required.';

    const columns = String(args.columns || '');
    const colFilter = columns ? `df = df[[${columns.split(',').map(c => `'${c.trim()}'`).join(', ')}]]` : '';

    const script = this.loadScript(filePath, `
${colFilter}
numeric_df = df.select_dtypes(include=[np.number])
corr = numeric_df.corr()
print("Correlation Matrix:")
print(corr.to_string())
print("\\nStrongest correlations (|r| > 0.7):")
for i in range(len(corr.columns)):
  for j in range(i+1, len(corr.columns)):
    r = corr.iloc[i, j]
    if abs(r) > 0.7:
      print(f"  {corr.columns[i]} <-> {corr.columns[j]}: {r:.4f}")
`);
    return `Correlation analysis:\n${await this.runPython(script)}`;
  }

  private async regression(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    const xCol = String(args.x_column || '');
    const yCol = String(args.y_column || '');
    if (!filePath || !xCol || !yCol) return 'Error: "file_path", "x_column", and "y_column" are required.';

    const script = this.loadScript(filePath, `
from numpy.polynomial.polynomial import polyfit
x = df['${xCol.replace(/'/g, "\\'")}'].dropna()
y = df['${yCol.replace(/'/g, "\\'")}'].dropna()
idx = x.index.intersection(y.index)
x, y = x.loc[idx], y.loc[idx]
b, m = polyfit(x, y, 1)
y_pred = m * x + b
ss_res = ((y - y_pred) ** 2).sum()
ss_tot = ((y - y.mean()) ** 2).sum()
r_squared = 1 - ss_res / ss_tot if ss_tot != 0 else 0
print(f"Linear Regression: {yCol} = {m:.6f} * {xCol} + {b:.6f}")
print(f"R² = {r_squared:.6f}")
print(f"n = {len(x)}")
print(f"Slope (m) = {m:.6f}")
print(f"Intercept (b) = {b:.6f}")
`);
    return `Regression analysis:\n${await this.runPython(script)}`;
  }

  private async aggregate(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    const groupBy = String(args.group_by || '');
    const aggFunc = String(args.agg_function || 'mean');
    if (!filePath || !groupBy) return 'Error: "file_path" and "group_by" are required.';

    const columns = String(args.columns || '');
    const colSelect = columns ? `result = result[[${columns.split(',').map(c => `'${c.trim()}'`).join(', ')}]]` : '';

    const script = this.loadScript(filePath, `
result = df.groupby('${groupBy.replace(/'/g, "\\'")}').${aggFunc}()
${colSelect}
print(result.to_string())
`);
    return `Aggregation (${aggFunc} by ${groupBy}):\n${await this.runPython(script)}`;
  }

  private async pivot(args: Record<string, unknown>): Promise<string> {
    return 'Error: Pivot requires specifying index, columns, and values. Use "execute" action with custom pandas code for pivot tables.';
  }

  private async clean(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    if (!filePath) return 'Error: "file_path" is required.';

    const naAction = String(args.na_action || 'drop');
    let naHandler: string;
    switch (naAction) {
      case 'drop': naHandler = 'df = df.dropna()'; break;
      case 'fill_mean': naHandler = 'df = df.fillna(df.mean(numeric_only=True))'; break;
      case 'fill_median': naHandler = 'df = df.fillna(df.median(numeric_only=True))'; break;
      case 'fill_zero': naHandler = 'df = df.fillna(0)'; break;
      case 'fill_ffill': naHandler = 'df = df.ffill()'; break;
      default: naHandler = 'df = df.dropna()';
    }

    const script = this.loadScript(filePath, `
before = df.shape
${naHandler}
df = df.drop_duplicates()
after = df.shape
print(f"Before: {before[0]} rows x {before[1]} cols")
print(f"After: {after[0]} rows x {after[1]} cols")
print(f"Rows removed: {before[0] - after[0]}")
print(f"\\nCleaned dtypes:\\n{df.dtypes.to_string()}")
`);
    return `Data cleaning:\n${await this.runPython(script)}`;
  }

  private async filter(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    const filterExpr = String(args.filter_expr || '');
    if (!filePath || !filterExpr) return 'Error: "file_path" and "filter_expr" are required.';

    const maxRows = Number(args.max_rows || 50);
    const script = this.loadScript(filePath, `
result = df.query('${filterExpr.replace(/'/g, "\\'")}')
print(f"Filtered: {len(result)} rows (from {len(df)})")
print(result.head(${maxRows}).to_string())
`);
    return `Filtered data:\n${await this.runPython(script)}`;
  }

  private async merge(args: Record<string, unknown>): Promise<string> {
    return 'Error: Merge requires two file paths. Use "execute" action with custom pandas code for merges.';
  }

  private async sample(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    if (!filePath) return 'Error: "file_path" is required.';

    const maxRows = Number(args.max_rows || 10);
    const script = this.loadScript(filePath, `
sample = df.sample(n=min(${maxRows}, len(df)), random_state=42)
print(sample.to_string())
`);
    return `Random sample:\n${await this.runPython(script)}`;
  }

  private async profile(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    if (!filePath) return 'Error: "file_path" is required.';

    const script = this.loadScript(filePath, `
print(f"Shape: {df.shape[0]} rows x {df.shape[1]} columns")
print(f"Memory: {df.memory_usage(deep=True).sum() / 1024:.1f} KB")
print(f"\\nColumn types:")
for col in df.columns:
  dtype = df[col].dtype
  nulls = df[col].isnull().sum()
  unique = df[col].nunique()
  print(f"  {col}: {dtype} | nulls={nulls} | unique={unique}")
  if dtype in ['int64', 'float64']:
    print(f"    min={df[col].min()}, max={df[col].max()}, mean={df[col].mean():.2f}")
  elif dtype == 'object' and unique < 20:
    print(f"    top values: {df[col].value_counts().head(5).to_dict()}")
`);
    return `Data profile:\n${await this.runPython(script)}`;
  }

  private async executeCode(args: Record<string, unknown>): Promise<string> {
    const code = String(args.code || '');
    if (!code) return 'Error: "code" is required for execute.';

    const filePath = String(args.file_path || '');
    const fullScript = filePath
      ? this.loadScript(filePath, code)
      : `import pandas as pd\nimport numpy as np\n${code}`;

    const result = await this.runPython(fullScript);
    return `Execution result:\n${result.slice(0, 10000)}`;
  }
}
