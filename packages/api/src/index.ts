/**
 * Apollo API Server
 */

import { createApp } from './app.js';
import { config, createStorageContext } from './config.js';

const ctx = createStorageContext();
const app = createApp(ctx);

app.listen(config.port, () => {
  console.log(`Apollo API server listening on port ${config.port}`);
  console.log(`Data directory: ${ctx.dataDir}`);
  console.log(`Health check: http://localhost:${config.port}/health`);
});
