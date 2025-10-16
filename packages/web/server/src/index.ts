import dotenv from 'dotenv';
import { resolve } from 'node:path';
import type { Server } from 'node:http';
import { createApp, type WebServerConfig } from './app.js';

// Load .env from workspace root (2 levels up from packages/web)
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

// Export for external use
export { createApp, type WebServerConfig } from './app.js';

/**
 * Start the web server
 * @param config Server configuration
 * @returns Promise that resolves with the HTTP server instance
 */
export async function startServer(config: WebServerConfig = {}): Promise<Server> {
  const { port = 3001, host = 'localhost' } = config;
  const app = createApp();

  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(port, host, () => {
        console.log(`🚀 Agent System Web Server running on http://${host}:${port}`);
        console.log(`📡 SSE endpoint: http://${host}:${port}/events/:sessionId`);
        console.log(`🔌 API endpoint: http://${host}:${port}/api/executions`);
        resolve(server);
      });

      server.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}
