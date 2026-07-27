import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

function findProjectRoot() {
  let dir = process.cwd();
  for (let i = 0; i < 5; i += 1) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

const PROJECT_ROOT = findProjectRoot();
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const token = process.env.PUTER_AUTH_TOKEN || '';
const model = process.env.QWEN_MODEL || 'openrouter:qwen/qwen-plus';

if (!token) {
  console.error('PUTER_AUTH_TOKEN is not filled in .env.');
  process.exit(1);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 12000);

try {
  const response = await fetch('https://api.puter.com/puterai/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'user', content: 'Reply only with: TESTE QWEN OK' },
      ],
      max_tokens: 20,
    }),
    signal: controller.signal,
  });

  const payload = await response.text();
  clearTimeout(timeout);

  console.log(`HTTP ${response.status}`);
  console.log(payload);

  if (!response.ok) {
    process.exit(1);
  }
} catch (error) {
  clearTimeout(timeout);
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to validate token Puter: ${message}`);
  process.exit(1);
}
