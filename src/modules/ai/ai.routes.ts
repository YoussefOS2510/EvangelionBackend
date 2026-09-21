import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { aiQuestionService } from './ai.service.js';
import { readingsService } from '../readings/readings.service.js';
import { query } from '../../db/pool.js';
import { errorResponseSchema } from '../../config/swagger.schemas.js';

const aiGenerateSchema = z.object({
  reading_id: z.string().min(1),
  type: z.enum(['mcq', 'true_false']).default('mcq')
});

export async function aiRoutes(fastify: FastifyInstance) {
  fastify.post('/admin/questions/ai-generate', {
    schema: {
      tags: ['AI', 'Admin'],
      summary: 'Generate draft comprehension question via AI',
      description: 'Prompts Gemini LLM to generate an age-appropriate bilingual question strictly grounded on the passage verses.',
      body: {
        type: 'object',
        properties: {
          reading_id: { type: 'string', description: 'Target Reading UUID or ID' },
          type: { type: 'string', enum: ['mcq', 'true_false'], default: 'mcq' }
        },
        required: ['reading_id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            reading_id: { type: 'string' },
            draft_question: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                prompt_ar: { type: 'string' },
                prompt_en: { type: 'string' },
                options: { type: 'object', additionalProperties: true },
                correct_answer: { type: 'string' }
              }
            }
          }
        },
        ...errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const parseResult = aiGenerateSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.flatten()
      });
    }

    const { reading_id, type } = parseResult.data;

    // Fetch reading details and target group grade bracket
    const rRes = await query(`
      SELECT dr.*, g.min_grade, g.max_grade
      FROM daily_readings dr
      JOIN groups g ON g.id = dr.group_id
      WHERE dr.id = $1
    `, [reading_id]);

    if (rRes.rows.length === 0) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Reading not found'
      });
    }

    const reading = rRes.rows[0];

    // Extract passage verses
    const verses = await readingsService.extractVerses(
      reading.book_number,
      reading.start_chapter,
      reading.start_verse,
      reading.end_chapter,
      reading.end_verse,
      reading.excluded_verses || []
    );

    if (verses.length === 0) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'No verses found in passage range for question generation'
      });
    }

    try {
      const draftQuestion = await aiQuestionService.generateQuestionForPassage(
        verses,
        reading.min_grade,
        reading.max_grade,
        type
      );

      return {
        reading_id,
        draft_question: draftQuestion
      };
    } catch (err: any) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'AI Generation Failed',
        message: err.message
      });
    }
  });
}
