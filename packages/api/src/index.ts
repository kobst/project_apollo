/**
 * Apollo API Server
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load .env from project root - search upward from current directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
function findEnvFile(startDir: string): string | null {
  let dir = startDir;
  for (let i = 0; i < 5; i++) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) return envPath;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
const envPath = findEnvFile(__dirname);
if (envPath) {
  dotenv.config({ path: envPath, override: true });
}

import { createApp } from './app.js';
import { config, createStorageContext } from './config.js';

const ctx = createStorageContext();
const app = createApp(ctx);

app.listen(config.port, () => {
  console.log(`Apollo API server listening on port ${config.port}`);
  console.log(`Data directory: ${ctx.dataDir}`);
  console.log(`AI configured: ${Boolean(process.env.ANTHROPIC_API_KEY)}`);
  console.log(`Health check: http://localhost:${config.port}/health`);
});
