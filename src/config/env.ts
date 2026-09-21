import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  
  db: {
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/evangelion',
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'evangelion',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  },

  church: {
    timezone: process.env.CHURCH_TIMEZONE || 'Africa/Cairo',
    defaultPointsPerQuestion: parseInt(process.env.DEFAULT_POINTS_PER_QUESTION || '10', 10),
  }
};
