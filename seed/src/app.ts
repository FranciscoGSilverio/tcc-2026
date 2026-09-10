import Fastify, { type FastifyInstance } from 'fastify';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { loadConfig } from './config.js';
import { errorHandlerPlugin } from './plugins/error-handler.js';
import { registerModules } from './plugins/register-modules.js';
import { requestIdPlugin } from './plugins/request-id.js';

export interface BuildOptions {
  logger?: boolean;
}

export async function buildApp(options: BuildOptions = {}): Promise<FastifyInstance> {
  const config = loadConfig();
  const app = Fastify({
    logger: options.logger === false ? false : { level: config.logLevel },
  }).withTypeProvider<TypeBoxTypeProvider>();

  // requestIdPlugin and errorHandlerPlugin are invoked directly on the root
  // instance, not through app.register(). Fastify's register() creates an
  // encapsulated child context, and hooks/handlers added inside it are not
  // visible to sibling plugins (such as registerModules and the module
  // plugins registered in later tasks). Calling them directly keeps the
  // request-id header and the global error handler in effect for every
  // route in the app.
  await requestIdPlugin(app);
  await errorHandlerPlugin(app);
  await app.register(registerModules);

  return app;
}
