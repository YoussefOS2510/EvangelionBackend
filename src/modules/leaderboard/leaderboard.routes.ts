import { FastifyInstance } from 'fastify';
import { leaderboardService, LeaderboardWindow } from '../../redis/leaderboard.service.js';
import { query } from '../../db/pool.js';
import { errorResponseSchema } from '../../config/swagger.schemas.js';

export async function leaderboardRoutes(fastify: FastifyInstance) {
  fastify.get('/leaderboard', {
    schema: {
      tags: ['Leaderboard'],
      summary: 'Get cohort rankings across time windows',
      description: 'Fetches Top-50 or custom limit rankings from Redis Sorted Sets for a specific cohort across weekly, monthly, or all_time windows.',
      querystring: {
        type: 'object',
        properties: {
          window: {
            type: 'string',
            enum: ['weekly', 'monthly', 'all_time'],
            default: 'weekly',
            description: 'Time window for rankings'
          },
          limit: {
            type: 'string',
            default: '50',
            description: 'Max number of top kids to return'
          }
        }
      },
      headers: {
        type: 'object',
        properties: {
          'x-group-id': { type: 'string', description: 'Cohort Group ID (1 to 7)' },
          'x-user-id': { type: 'string', description: 'Optional Student UUID to fetch individual standing' }
        },
        required: ['x-group-id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            group_id: { type: 'number' },
            window: { type: 'string' },
            total_ranked: { type: 'number' },
            my_standing: {
              type: 'object',
              nullable: true,
              properties: {
                rank: { type: 'number', nullable: true },
                score: { type: 'number' }
              }
            },
            leaderboard: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'string' },
                  score: { type: 'number' },
                  rank: { type: 'number' },
                  full_name: { type: 'string' },
                  current_streak: { type: 'number' }
                }
              }
            }
          }
        },
        ...errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const q = request.query as { window?: string; limit?: string };
    const window: LeaderboardWindow = (['weekly', 'monthly', 'all_time'].includes(q.window || ''))
      ? (q.window as LeaderboardWindow)
      : 'weekly';
    const limit = parseInt(q.limit || '50', 10);

    const user = (request as any).user;
    const groupId = user?.groupId || parseInt(request.headers['x-group-id'] as string, 10);
    const userId = user?.id || (request.headers['x-user-id'] as string);

    if (!groupId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing group identification (X-Group-Id header or user profile)'
      });
    }

    // 1. Fetch ranking from Redis ZSET
    const entries = await leaderboardService.getLeaderboard(groupId, window, limit);

    // 2. Fetch user standing
    let myStanding: { rank: number | null; score: number } | null = null;
    if (userId) {
      myStanding = await leaderboardService.getUserStanding(groupId, userId, window);
    }

    // 3. Enrich entries with user names from PostgreSQL
    let enrichedEntries = entries;
    if (entries.length > 0) {
      const userIds = entries.map(e => e.userId);
      const usersRes = await query(
        `SELECT id, full_name, preferred_lang, current_streak FROM users WHERE id = ANY($1::uuid[])`,
        [userIds]
      );
      const userMap = new Map(usersRes.rows.map(u => [u.id, u]));

      enrichedEntries = entries.map(e => {
        const u = userMap.get(e.userId);
        return {
          ...e,
          full_name: u?.full_name || 'Student',
          current_streak: u?.current_streak || 0
        };
      });
    }

    return {
      group_id: groupId,
      window,
      total_ranked: enrichedEntries.length,
      my_standing: myStanding,
      leaderboard: enrichedEntries
    };
  });
}
