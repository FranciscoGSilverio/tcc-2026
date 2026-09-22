export interface Config {
  port: number;
  logLevel: string;
  nodeEnv: string;
}

export function loadConfig(): Config {
  const port = Number(process.env.PORT ?? 3000);
  if (Number.isNaN(port)) {
    throw new Error('PORT must be a number');
  }
  return {
    port,
    logLevel: process.env.LOG_LEVEL ?? 'info',
    nodeEnv: process.env.NODE_ENV ?? 'development',
  };
}
