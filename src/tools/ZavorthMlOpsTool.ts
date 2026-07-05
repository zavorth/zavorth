import fs from 'fs';
import path from 'path';
import { BaseTool } from './BaseTool.js';
import type { ToolDefinition } from '@zavorth/providers/ILlmProvider.js';

export class ZavorthMlOpsTool extends BaseTool {
  public readonly name = 'zavorth_ml_ops';

  public readonly description =
    'ML operations — model training, evaluation, hyperparameter tuning, experiment tracking, model registry, deployment, and monitoring via scikit-learn, MLflow, and standard ML tooling.';

  public readonly parameters: ToolDefinition['parameters'] = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: "Action: 'train', 'evaluate', 'predict', 'tune', 'compare', 'feature_importance', 'cross_validate', 'save_model', 'load_model', 'list_models', 'deploy', 'monitor', 'execute'.",
      },
      file_path: {
        type: 'string',
        description: 'Path to training data (CSV, JSON, Parquet).',
      },
      model_type: {
        type: 'string',
        description: "Model type: 'random_forest', 'gradient_boosting', 'linear_regression', 'logistic_regression', 'svm', 'knn', 'decision_tree', 'xgboost'.",
      },
      target_column: {
        type: 'string',
        description: 'Target variable column name.',
      },
      feature_columns: {
        type: 'string',
        description: 'Comma-separated feature column names. Default: all except target.',
      },
      test_size: {
        type: 'number',
        description: 'Test set proportion. Default: 0.2.',
      },
      model_name: {
        type: 'string',
        description: 'Model name for saving/loading/registry.',
      },
      model_path: {
        type: 'string',
        description: 'Path to saved model file (.pkl, .joblib).',
      },
      hyperparameters: {
        type: 'string',
        description: 'JSON string of hyperparameters.',
      },
      n_folds: {
        type: 'number',
        description: 'Number of cross-validation folds. Default: 5.',
      },
      metric: {
        type: 'string',
        description: "Evaluation metric: 'accuracy', 'precision', 'recall', 'f1', 'rmse', 'mae', 'r2', 'auc'.",
      },
      code: {
        type: 'string',
        description: 'Custom Python code for execute action.',
      },
      output_format: {
        type: 'string',
        description: "Output format: 'text', 'json'. Default: 'text'.",
      },
    },
    required: ['action'],
  };

  public async execute(args: Record<string, unknown>): Promise<string> {
    const action = String(args.action || '');
    if (!action) return 'Error: "action" parameter is required.';

    switch (action) {
      case 'train': return await this.train(args);
      case 'evaluate': return await this.evaluate(args);
      case 'predict': return await this.predict(args);
      case 'tune': return await this.tune(args);
      case 'compare': return await this.compare(args);
      case 'feature_importance': return await this.featureImportance(args);
      case 'cross_validate': return await this.crossValidate(args);
      case 'save_model': return await this.saveModel(args);
      case 'load_model': return await this.loadModel(args);
      case 'list_models': return await this.listModels(args);
      case 'deploy': return await this.deploy(args);
      case 'monitor': return await this.monitor(args);
      case 'execute': return await this.executeCode(args);
      default: return `Error: action "${action}" is invalid.`;
    }
  }

  private async runPython(script: string, timeout = 120000): Promise<string> {
    try {
      const { execFileSync } = await import('child_process');
      const result = execFileSync('python', ['-c', script], {
        timeout,
        maxBuffer: 50 * 1024 * 1024,
      }).toString();
      return result.trim();
    } catch (error) { logger.warn('[Zavorth Ml Ops] process execution failed', error); return ''; }
  }

  private getModelCode(modelType: string, hyperparams: string): string {
    const params = hyperparams ? `, ${hyperparams}` : '';
    switch (modelType) {
      case 'random_forest':
        return `model = RandomForestClassifier(n_estimators=100${params}) if task == 'classification' else RandomForestRegressor(n_estimators=100${params})`;
      case 'gradient_boosting':
        return `model = GradientBoostingClassifier(n_estimators=100${params}) if task == 'classification' else GradientBoostingRegressor(n_estimators=100${params})`;
      case 'linear_regression':
        return `model = LinearRegression(${hyperparams})`;
      case 'logistic_regression':
        return `model = LogisticRegression(max_iter=1000${params})`;
      case 'svm':
        return `model = SVC(probability=True${params}) if task == 'classification' else SVR(${params})`;
      case 'knn':
        return `model = KNeighborsClassifier(${params}) if task == 'classification' else KNeighborsRegressor(${params})`;
      case 'decision_tree':
        return `model = DecisionTreeClassifier(${params}) if task == 'classification' else DecisionTreeRegressor(${params})`;
      default:
        return `model = RandomForestClassifier(n_estimators=100${params}) if task == 'classification' else RandomForestRegressor(n_estimators=100${params})`;
    }
  }

  private async train(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    const modelType = String(args.model_type || 'random_forest');
    const target = String(args.target_column || '');
    if (!filePath || !target) return 'Error: "file_path" and "target_column" are required.';

    const testSize = Number(args.test_size || 0.2);
    const features = String(args.feature_columns || '');
    const hyperparams = String(args.hyperparameters || '');

    const featureSelect = features
      ? `X = df[[${features.split(',').map(f => `'${f.trim()}'`).join(', ')}]]`
      : `X = df.drop(columns=['${target.replace(/'/g, "\\'")}'])`;

    const script = `
import pandas as pd
import numpy as np
import json
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor, GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.svm import SVC, SVR
from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, mean_squared_error, mean_absolute_error, r2_score
from sklearn.preprocessing import LabelEncoder
import joblib

df = pd.read_csv('${filePath.replace(/\\/g, '/').replace(/'/g, "\\'")}')
target_col = '${target.replace(/'/g, "\\'")}'

${featureSelect}
y = df[target_col]

if y.dtype == 'object':
  task = 'classification'
  le = LabelEncoder()
  y = le.fit_transform(y)
elif y.nunique() < 20:
  task = 'classification'
else:
  task = 'regression'

X = pd.get_dummies(X, drop_first=True)
X = X.fillna(X.mean(numeric_only=True))

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=${testSize}, random_state=42)

${this.getModelCode(modelType, hyperparams)}

model.fit(X_train, y_train)
y_pred = model.predict(X_test)

print(f"Task: {task}")
print(f"Model: ${modelType}")
print(f"Train size: {len(X_train)}, Test size: {len(X_test)}")

if task == 'classification':
  print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
  print(f"Precision: {precision_score(y_test, y_pred, average='weighted'):.4f}")
  print(f"Recall: {recall_score(y_test, y_pred, average='weighted'):.4f}")
  print(f"F1: {f1_score(y_test, y_pred, average='weighted'):.4f}")
else:
  print(f"RMSE: {np.sqrt(mean_squared_error(y_test, y_pred)):.4f}")
  print(f"MAE: {mean_absolute_error(y_test, y_pred):.4f}")
  print(f"R²: {r2_score(y_test, y_pred):.4f}")

joblib.dump(model, 'zavorth_model_latest.pkl')
print("Model saved to zavorth_model_latest.pkl")
`;
    return `Training result:\n${await this.runPython(script)}`;
  }

  private async evaluate(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    const modelPath = String(args.model_path || 'zavorth_model_latest.pkl');
    const target = String(args.target_column || '');
    if (!filePath || !target) return 'Error: "file_path" and "target_column" are required.';

    const script = `
import pandas as pd
import numpy as np
import joblib
from sklearn.metrics import classification_report, confusion_matrix, mean_squared_error, r2_score
from sklearn.preprocessing import LabelEncoder

model = joblib.load('${modelPath.replace(/\\/g, '/').replace(/'/g, "\\'")}')
df = pd.read_csv('${filePath.replace(/\\/g, '/').replace(/'/g, "\\'")}')
target_col = '${target.replace(/'/g, "\\'")}'

X = df.drop(columns=[target_col])
y = df[target_col]
if y.dtype == 'object':
  le = LabelEncoder()
  y = le.fit_transform(y)

X = pd.get_dummies(X, drop_first=True)
X = X.fillna(X.mean(numeric_only=True))

y_pred = model.predict(X)

if hasattr(model, 'predict_proba'):
  print("Classification Report:")
  print(classification_report(y, y_pred))
  print("Confusion Matrix:")
  print(confusion_matrix(y, y_pred))
else:
  print(f"RMSE: {np.sqrt(mean_squared_error(y, y_pred)):.4f}")
  print(f"R²: {r2_score(y, y_pred):.4f}")
`;
    return `Evaluation:\n${await this.runPython(script)}`;
  }

  private async predict(args: Record<string, unknown>): Promise<string> {
    return 'Error: Predict requires data input. Use "execute" action with custom code for predictions.';
  }

  private async tune(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    const modelType = String(args.model_type || 'random_forest');
    const target = String(args.target_column || '');
    if (!filePath || !target) return 'Error: "file_path" and "target_column" are required.';

    const script = `
import pandas as pd
import numpy as np
from sklearn.model_selection import GridSearchCV, train_test_split
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import LabelEncoder

df = pd.read_csv('${filePath.replace(/\\/g, '/').replace(/'/g, "\\'")}')
target_col = '${target.replace(/'/g, "\\'")}'

X = df.drop(columns=[target_col])
y = df[target_col]
if y.dtype == 'object':
  le = LabelEncoder()
  y = le.fit_transform(y)

X = pd.get_dummies(X, drop_first=True)
X = X.fillna(X.mean(numeric_only=True))

task = 'classification' if len(np.unique(y)) < 20 else 'regression'

if task == 'classification':
  model = RandomForestClassifier(random_state=42)
else:
  model = RandomForestRegressor(random_state=42)

param_grid = {
  'n_estimators': [50, 100, 200],
  'max_depth': [5, 10, 20, None],
  'min_samples_split': [2, 5, 10],
}

grid = GridSearchCV(model, param_grid, cv=3, scoring='accuracy' if task == 'classification' else 'r2', n_jobs=-1)
grid.fit(X, y)

print(f"Best params: {grid.best_params_}")
print(f"Best score: {grid.best_score_:.4f}")
print(f"\\nTop 5 configurations:")
results = sorted(zip(grid.cv_results_['params'], grid.cv_results_['mean_test_score']), key=lambda x: -x[1])
for params, score in results[:5]:
  print(f"  {score:.4f} - {params}")
`;
    return `Hyperparameter tuning:\n${await this.runPython(script)}`;
  }

  private async compare(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    const target = String(args.target_column || '');
    if (!filePath || !target) return 'Error: "file_path" and "target_column" are required.';

    const script = `
import pandas as pd
import numpy as np
from sklearn.model_selection import cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import LabelEncoder

df = pd.read_csv('${filePath.replace(/\\/g, '/').replace(/'/g, "\\'")}')
target_col = '${target.replace(/'/g, "\\'")}'

X = df.drop(columns=[target_col])
y = df[target_col]
if y.dtype == 'object':
  le = LabelEncoder()
  y = le.fit_transform(y)

X = pd.get_dummies(X, drop_first=True)
X = X.fillna(X.mean(numeric_only=True))

models = {
  'RandomForest': RandomForestClassifier(n_estimators=100, random_state=42),
  'GradientBoosting': GradientBoostingClassifier(n_estimators=100, random_state=42),
  'LogisticRegression': LogisticRegression(max_iter=1000, random_state=42),
  'KNN': KNeighborsClassifier(),
}

print("Model Comparison (3-fold CV):")
results = []
for name, model in models.items():
  scores = cross_val_score(model, X, y, cv=3, scoring='accuracy')
  results.append((name, scores.mean(), scores.std()))
  print(f"  {name}: {scores.mean():.4f} (+/- {scores.std():.4f})")

results.sort(key=lambda x: -x[1])
print(f"\\nBest: {results[0][0]} ({results[0][1]:.4f})")
`;
    return `Model comparison:\n${await this.runPython(script)}`;
  }

  private async featureImportance(args: Record<string, unknown>): Promise<string> {
    const modelPath = String(args.model_path || 'zavorth_model_latest.pkl');

    const script = `
import joblib
import numpy as np

model = joblib.load('${modelPath.replace(/\\/g, '/').replace(/'/g, "\\'")}')

if hasattr(model, 'feature_importances_'):
  importances = model.feature_importances_
  if hasattr(model, 'feature_names_in_'):
    names = model.feature_names_in_
  else:
    names = [f'feature_{i}' for i in range(len(importances))]
  
  sorted_idx = np.argsort(importances)[::-1]
  print("Feature Importance (top 20):")
  for i in sorted_idx[:20]:
    print(f"  {names[i]}: {importances[i]:.4f}")
else:
  print("Model does not support feature_importances_")
`;
    return `Feature importance:\n${await this.runPython(script)}`;
  }

  private async crossValidate(args: Record<string, unknown>): Promise<string> {
    const filePath = String(args.file_path || '');
    const modelType = String(args.model_type || 'random_forest');
    const target = String(args.target_column || '');
    const nFolds = Number(args.n_folds || 5);
    if (!filePath || !target) return 'Error: "file_path" and "target_column" are required.';

    const script = `
import pandas as pd
import numpy as np
import { logger } from '../logger.js';
from sklearn.model_selection import cross_val_score
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import LabelEncoder

df = pd.read_csv('${filePath.replace(/\\/g, '/').replace(/'/g, "\\'")}')
target_col = '${target.replace(/'/g, "\\'")}'

X = df.drop(columns=[target_col])
y = df[target_col]
if y.dtype == 'object':
  le = LabelEncoder()
  y = le.fit_transform(y)

X = pd.get_dummies(X, drop_first=True)
X = X.fillna(X.mean(numeric_only=True))

task = 'classification' if len(np.unique(y)) < 20 else 'regression'
model = RandomForestClassifier(n_estimators=100, random_state=42) if task == 'classification' else RandomForestRegressor(n_estimators=100, random_state=42)

scoring = 'accuracy' if task == 'classification' else 'r2'
scores = cross_val_score(model, X, y, cv=${nFolds}, scoring=scoring)

print(f"Cross-validation (${nFolds} folds):")
print(f"  Scores: {[f'{s:.4f}' for s in scores]}")
print(f"  Mean: {scores.mean():.4f}")
print(f"  Std: {scores.std():.4f}")
`;
    return `Cross-validation:\n${await this.runPython(script)}`;
  }

  private async saveModel(args: Record<string, unknown>): Promise<string> {
    const modelPath = String(args.model_path || 'zavorth_model_latest.pkl');
    const modelName = String(args.model_name || 'latest');

    try {
      if (!fs.existsSync(modelPath)) return `Error: Model file not found at ${modelPath}.`;
      const destDir = path.join(process.cwd(), '.zavorth_models');
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      const dest = path.join(destDir, `${modelName}.pkl`);
      fs.copyFileSync(modelPath, dest);
      return `Model saved as "${modelName}" to ${dest}`;
    } catch (error) { logger.warn('[Zavorth Ml Ops] filesystem operation failed', error); return ''; }
  }

  private async loadModel(args: Record<string, unknown>): Promise<string> {
    const modelName = String(args.model_name || 'latest');
    const modelDir = path.join(process.cwd(), '.zavorth_models');
    const modelPath = path.join(modelDir, `${modelName}.pkl`);

    if (!fs.existsSync(modelPath)) return `Error: Model "${modelName}" not found in ${modelDir}.`;

    const stats = fs.statSync(modelPath);
    return `Model "${modelName}" loaded from ${modelPath} (${(stats.size / 1024).toFixed(1)} KB, modified: ${stats.mtime.toISOString()})`;
  }

  private async listModels(args: Record<string, unknown>): Promise<string> {
    const modelDir = path.join(process.cwd(), '.zavorth_models');
    if (!fs.existsSync(modelDir)) return 'No models directory found.';

    const files = fs.readdirSync(modelDir).filter(f => f.endsWith('.pkl') || f.endsWith('.joblib'));
    if (files.length === 0) return 'No saved models found.';

    return [
      `Saved models (${files.length}):`,
      ...files.map(f => {
        const stats = fs.statSync(path.join(modelDir, f));
        return `  ${f} (${(stats.size / 1024).toFixed(1)} KB, ${stats.mtime.toISOString()})`;
      }),
    ].join('\n');
  }

  private async deploy(args: Record<string, unknown>): Promise<string> {
    return 'Model deployment requires integration with a serving framework (FastAPI, TensorFlow Serving, etc.). Use "execute" action with custom deployment code.';
  }

  private async monitor(args: Record<string, unknown>): Promise<string> {
    return 'Model monitoring requires integration with monitoring tools (MLflow, Evidently, etc.). Use "execute" action with custom monitoring code.';
  }

  private async executeCode(args: Record<string, unknown>): Promise<string> {
    const code = String(args.code || '');
    if (!code) return 'Error: "code" is required for execute.';

    const script = `import pandas as pd\nimport numpy as np\nimport joblib\nfrom sklearn import *\n${code}`;
    const result = await this.runPython(script);
    return `Execution result:\n${result.slice(0, 10000)}`;
  }
}
