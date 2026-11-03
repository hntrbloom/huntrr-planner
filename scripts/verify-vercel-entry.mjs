import { createServer } from 'node:http';

// Exercise the transpiled ESM function entry under plain Node, without tsx's
// extension resolution. This catches production-only import/cold-start errors.
process.env.NODE_ENV = 'production';
const { default: handler } = await import('../work/vercel-entry.mjs');
const server = createServer((req, res) => Promise.resolve(handler(req, res)).catch(error => {
  console.error(error);
  res.writeHead(500).end('Function startup failed');
}));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
process.argv[2] = `http://127.0.0.1:${address.port}`;
try {
  await import('./verify-production.mjs');
} finally {
  await new Promise(resolve => server.close(resolve));
}
