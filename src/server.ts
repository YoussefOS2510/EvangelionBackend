import { buildApp } from './app.js';
import { config } from './config/env.js';
import { runMigrations, runSeeds } from './db/migrate.js';

const app = buildApp();

async function start() {
  try {
    // Attempt database migrations if PostgreSQL is available
    try {
      await runMigrations();
      await runSeeds();
    } catch (migErr: any) {
      console.warn('⚠️ [Startup DB] Migrations skipped or using fallback store:', migErr?.message || migErr);
    }

    await app.listen({ port: config.port, host: config.host });
    const baseUrl = `http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`;
    console.log(`✨ Evangelion backend listening at ${baseUrl}`);
    console.log(`📖 Swagger UI Documentation: ${baseUrl}/docs`);
    console.log(`📄 OpenAPI Specification JSON: ${baseUrl}/docs/json`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
// Auto-reloaded with complete bilingual scripture dataset
