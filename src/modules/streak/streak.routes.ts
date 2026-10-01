import { FastifyInstance } from 'fastify';
import { streakService } from './streak.service.js';
import { errorResponseSchema } from '../../config/swagger.schemas.js';

export async function streakRoutes(fastify: FastifyInstance) {
  // 1. Detailed Streak and Reading History
  fastify.get('/streak', {
    schema: {
      tags: ['Streak'],
      summary: 'Get student daily reading streak details and calendar history',
      description: 'Calculates consecutive scheduled-day streaks without penalizing church off-days. Returns current streak, longest streak, today status (completed, pending, off_day, broken), next milestone, and recent reading history.',
      headers: {
        type: 'object',
        properties: {
          'x-user-id': { type: 'string', description: 'Student UUID' },
          'x-group-id': { type: 'string', description: 'Cohort Group ID (optional, defaults to student group)' }
        },
        required: ['x-user-id']
      },
      querystring: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date', description: 'Optional date override (YYYY-MM-DD)' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            group_id: { type: 'number' },
            current_streak: { type: 'number', description: 'Consecutive completed scheduled reading days' },
            longest_streak: { type: 'number', description: 'Highest streak recorded for student' },
            last_completed_date: { type: 'string', nullable: true },
            today_date: { type: 'string' },
            today_scheduled: { type: 'boolean', description: 'Whether today has a scheduled reading for this cohort' },
            today_completed: { type: 'boolean', description: 'Whether student completed all questions for today' },
            today_status: { 
              type: 'string', 
              enum: ['completed', 'pending', 'off_day', 'broken'],
              description: 'Current status: completed (done), pending (scheduled but waiting), off_day (no reading today), broken (missed previous reading)'
            },
            next_milestone: { type: 'number', description: 'Target milestone (e.g. 3, 7, 14, 30 days)' },
            days_to_milestone: { type: 'number', description: 'Days remaining until next milestone' },
            history: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  reading_id: { type: 'string' },
                  scheduled_date: { type: 'string' },
                  book_number: { type: 'number' },
                  book_name_ar: { type: 'string' },
                  book_name_en: { type: 'string' },
                  reference: {
                    type: 'object',
                    properties: {
                      ar: { type: 'string' },
                      en: { type: 'string' }
                    }
                  },
                  total_questions: { type: 'number' },
                  answered_questions: { type: 'number' },
                  correct_answers: { type: 'number' },
                  points_earned: { type: 'number' },
                  is_completed: { type: 'boolean' }
                }
              }
            }
          }
        },
        ...errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const user = (request as any).user;
    const userId = user?.id || (request.headers['x-user-id'] as string);
    const headerGroupId = request.headers['x-group-id'] 
      ? parseInt(request.headers['x-group-id'] as string, 10) 
      : undefined;
    const groupId = user?.groupId || headerGroupId;

    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing user identification (X-User-Id header)'
      });
    }

    const queryDate = (request.query as any)?.date;

    try {
      const details = await streakService.getUserStreak(userId, groupId, queryDate);
      return details;
    } catch (err: any) {
      if (err.message?.includes('USER_NOT_FOUND')) {
        return reply.status(404).send({
          error: 'Not Found',
          message: err.message
        });
      }
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve streak details'
      });
    }
  });

  // 2. Concise Streak Summary (Widget / Banner)
  fastify.get('/streak/summary', {
    schema: {
      tags: ['Streak'],
      summary: 'Get concise student daily reading streak summary',
      description: 'Returns lightweight streak stats (current streak, longest streak, today status, next milestone) ideal for mobile headers and streak widgets.',
      headers: {
        type: 'object',
        properties: {
          'x-user-id': { type: 'string', description: 'Student UUID' },
          'x-group-id': { type: 'string', description: 'Cohort Group ID (optional)' }
        },
        required: ['x-user-id']
      },
      querystring: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date', description: 'Optional date override (YYYY-MM-DD)' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            user_id: { type: 'string' },
            group_id: { type: 'number' },
            current_streak: { type: 'number' },
            longest_streak: { type: 'number' },
            last_completed_date: { type: 'string', nullable: true },
            today_status: { type: 'string', enum: ['completed', 'pending', 'off_day', 'broken'] },
            today_completed: { type: 'boolean' },
            today_scheduled: { type: 'boolean' },
            next_milestone: { type: 'number' },
            days_to_milestone: { type: 'number' }
          }
        },
        ...errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const user = (request as any).user;
    const userId = user?.id || (request.headers['x-user-id'] as string);
    const headerGroupId = request.headers['x-group-id'] 
      ? parseInt(request.headers['x-group-id'] as string, 10) 
      : undefined;
    const groupId = user?.groupId || headerGroupId;

    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing user identification (X-User-Id header)'
      });
    }

    const queryDate = (request.query as any)?.date;

    try {
      const details = await streakService.getUserStreak(userId, groupId, queryDate);
      return {
        user_id: details.user_id,
        group_id: details.group_id,
        current_streak: details.current_streak,
        longest_streak: details.longest_streak,
        last_completed_date: details.last_completed_date,
        today_status: details.today_status,
        today_completed: details.today_completed,
        today_scheduled: details.today_scheduled,
        next_milestone: details.next_milestone,
        days_to_milestone: details.days_to_milestone
      };
    } catch (err: any) {
      if (err.message?.includes('USER_NOT_FOUND')) {
        return reply.status(404).send({
          error: 'Not Found',
          message: err.message
        });
      }
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve streak summary'
      });
    }
  });
}
