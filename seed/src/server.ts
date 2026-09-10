import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { disconnect } from './db/client.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const app = await buildApp();

  const shutdown = async (): Promise<void> => {
    await app.close();
    await disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

void main();
