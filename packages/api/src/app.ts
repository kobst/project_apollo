/**
 * Express application setup
 */

import express from 'express';
import type { Express } from 'express';
import { createStorageContext, type StorageContext } from './config.js';
import { createStoriesRouter } from './routes/stories.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

/**
 * Create and configure the Express application.
 */
export function createApp(ctx?: StorageContext): Express {
  const app = express();
  const storageContext = ctx ?? createStorageContext();

  // Middleware
  app.use(express.json());

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', dataDir: storageContext.dataDir });
  });

  // API routes
  app.use('/stories', createStoriesRouter(storageContext));

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
