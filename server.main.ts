import { createApp } from './server';
process.env.NODE_ENV ||= 'production';
const port = Number(process.env.PORT || 3000);
createApp().then(app => {
  const server = app.listen(port, '0.0.0.0', () => console.log(`huntrr.organizer running on http://localhost:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}).catch(error => { console.error('Server startup failed:', error.message); process.exitCode = 1; });
