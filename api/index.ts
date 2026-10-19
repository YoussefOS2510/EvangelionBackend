import { buildApp } from '../src/app.js';

const app = buildApp();
let isReady = false;

export default async function handler(req: any, res: any) {
  if (!isReady) {
    await app.ready();
    isReady = true;
  }
  app.server.emit('request', req, res);
}
