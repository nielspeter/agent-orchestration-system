#!/usr/bin/env node
import { startServer } from './index.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST || 'localhost';

startServer({ port: PORT, host: HOST }).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
