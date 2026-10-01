import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { submissionsService } from './submissions.service.js';
import { errorResponseSchema } from '../../config/swagger.schemas.js';

const submitSchema = z.object({
  question_id: z.string().uuid(),
  answer: z.string().min(1)
});

export async function submissionsRoutes(fastify: FastifyInstance) {
  fastify.post('/readings/:id/submit', {
    schema: {
      tags: ['Submissions'],
      summary: 'Submit answer to a daily reading question',
      description: 'Records student answer, checks correctness, increments points, updates streak, and syncs Redis leaderboards.',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Reading UUID' }
        },
        required: ['id']
      },
      headers: {
        type: 'object',
        properties: {
          'x-user-id': { type: 'string', description: 'Student UUID' }
        },
        required: ['x-user-id']
      },
      body: {
        type: 'object',
        properties: {
          question_id: { type: 'string', format: 'uuid', description: 'Question UUID' },
          answer: { type: 'string', description: 'Selected option (A, B, C, D) or boolean' }
        },
        required: ['question_id', 'answer']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            question_id: { type: 'string' },
            is_correct: { type: 'boolean' },
            points_earned: { type: 'number' },
            current_total_points: { type: 'number' },
            current_streak: { type: 'number' },
            longest_streak: { type: 'number' },
            reading_completed: { type: 'boolean' }
          }
        },
        ...errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const { id: readingId } = request.params as { id: string };
    const user = (request as any).user;
    const userId = user?.id || (request.headers['x-user-id'] as string);

    if (!userId) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing user identification (X-User-Id header)'
      });
    }

    const parseResult = submitSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.flatten()
      });
    }

    const { question_id, answer } = parseResult.data;

    try {
      const result = await submissionsService.submitAnswer(userId, readingId, question_id, answer);
      return result;
    } catch (err: any) {
      if (err.message?.includes('ALREADY_SUBMITTED')) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'This question has already been submitted by this user.'
        });
      }
      if (err.message?.includes('NOT_FOUND')) {
        return reply.status(404).send({
          error: 'Not Found',
          message: err.message
        });
      }
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to record submission'
      });
    }
  });
}
