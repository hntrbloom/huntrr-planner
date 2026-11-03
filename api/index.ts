import type { Request, Response } from 'express';
import { createRequire } from 'node:module';

// Vercel transpiles this ESM entry without resolving extensionless TypeScript
// imports in the server's dependency tree. Load the production backend bundle,
// whose internal imports and Firebase JSON configuration are resolved at build time.
const require = createRequire(import.meta.url);
const { createApp } = require('../dist/app.cjs') as typeof import('../server');
const application = createApp();
export default async function handler(req: Request, res: Response) {
  return (await application)(req, res);
}
