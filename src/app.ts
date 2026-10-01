import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { config } from './config/env.js';
import { identityMiddleware } from './middleware/identity.middleware.js';
import { readingsRoutes } from './modules/readings/readings.routes.js';
import { submissionsRoutes } from './modules/submissions/submissions.routes.js';
import { streakRoutes } from './modules/streak/streak.routes.js';
import { aiRoutes } from './modules/ai/ai.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { leaderboardRoutes } from './modules/leaderboard/leaderboard.routes.js';

export function buildApp() {
  const app = Fastify({
    ajv: {
      customOptions: {
        keywords: ['example']
      }
    },
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info'
    }
  });

  // Enable CORS with full headers support
  app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['*'],
    credentials: true
  });

  // Register Swagger OpenAPI Spec
  app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'Evangelion Bilingual Bible Platform API',
        description: 'Interactive API documentation for church daily Bible reading, questions, submissions, and leaderboards.',
        version: '1.0.0'
      },
      servers: [
        {
          url: '/',
          description: 'Current Server (Relative)'
        }
      ],
      tags: [
        { name: 'Readings', description: 'Daily scripture and questions endpoints (Arabic, English, Bilingual)' },
        { name: 'Bible', description: 'Direct scripture reader and passage lookup endpoints (Arabic and English)' },
        { name: 'Streak', description: 'Student daily reading streak tracking, calendar history, and scheduled-day status' },
        { name: 'Submissions', description: 'Student question submissions and points' },
        { name: 'Leaderboard', description: 'Multi-window cohort rankings (weekly, monthly, all-time)' },
        { name: 'Admin', description: 'Passage scheduling, question commits, and servant reports' },
        { name: 'AI', description: 'Bilingual AI question generation' },
        { name: 'System', description: 'Health and diagnostics' }
      ],
      components: {
        securitySchemes: {
          UserIdHeader: {
            type: 'apiKey',
            name: 'X-User-Id',
            in: 'header',
            description: 'User UUID'
          },
          GroupIdHeader: {
            type: 'apiKey',
            name: 'X-Group-Id',
            in: 'header',
            description: 'Cohort Group ID (1 to 7)'
          },
          UserRoleHeader: {
            type: 'apiKey',
            name: 'X-User-Role',
            in: 'header',
            description: 'Role: kid | viewer_servant | admin_servant'
          }
        }
      }
    }
  });

  // Register Swagger UI at /docs and /documentation
  app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true
    },
    staticCSP: false
  });

  // Alias /json to /docs/json for relative Swagger UI resolutions
  app.get('/json', async (_request, reply) => {
    return reply.redirect('/docs/json');
  });

  // Redirect /documentation to /docs/
  app.get('/documentation', async (_request, reply) => {
    return reply.redirect('/docs/');
  });

  // Attach identity middleware
  app.addHook('onRequest', identityMiddleware);

  // Healthcheck endpoint
  app.get('/health', {
    schema: {
      tags: ['System'],
      summary: 'Service health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            service: { type: 'string' },
            timestamp: { type: 'string' },
            swagger_docs: { type: 'string' }
          }
        }
      }
    }
  }, async () => {
    return {
      status: 'ok',
      service: 'Evangelion Bilingual Bible Platform Backend',
      timestamp: new Date().toISOString(),
      swagger_docs: `/docs`
    };
  });

  // Register API v1 modules
  app.register(async (apiV1) => {
    apiV1.register(readingsRoutes);
    apiV1.register(submissionsRoutes);
    apiV1.register(streakRoutes);
    apiV1.register(aiRoutes);
    apiV1.register(adminRoutes);
    apiV1.register(leaderboardRoutes);
  }, { prefix: '/api/v1' });

  return app;
}
