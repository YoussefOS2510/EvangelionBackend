import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, getClient } from '../../db/pool.js';
import { errorResponseSchema } from '../../config/swagger.schemas.js';
import { readingsService } from '../readings/readings.service.js';
import { aiQuestionService } from '../ai/ai.service.js';

const scheduleSchema = z.object({
  group_ids: z.array(z.number().int()).min(1),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  book_number: z.number().int().min(1).max(66),
  start_chapter: z.number().int().min(1),
  start_verse: z.number().int().min(1),
  end_chapter: z.number().int().min(1).optional(),
  end_verse: z.number().int().min(1),
  excluded_verses: z.array(z.union([
    z.object({
      chapter: z.number().int(),
      verse: z.number().int()
    }),
    z.object({
      Chapter: z.number().int(),
      Verse: z.number().int()
    }).transform(obj => ({
      chapter: obj.Chapter,
      verse: obj.Verse
    }))
  ])).default([]),
  generate_ai_questions: z.boolean().default(false)
}).transform((data) => ({
  ...data,
  end_chapter: data.end_chapter ?? data.start_chapter
}));

const commitQuestionsSchema = z.object({
  reading_id: z.string().min(1),
  questions: z.array(z.object({
    type: z.enum(['mcq', 'true_false', 'short_answer']).default('mcq'),
    prompt_ar: z.string().min(1),
    prompt_en: z.string().min(1),
    options: z.record(z.object({
      ar: z.string(),
      en: z.string()
    })).optional(),
    correct_answer: z.string().min(1),
    points_value: z.number().int().default(10),
    sort_order: z.number().int().default(1),
    is_approved: z.boolean().default(true)
  })).min(1)
});

export async function adminRoutes(fastify: FastifyInstance) {
  // 1. Schedule Readings across multiple cohorts atomically
  fastify.post('/admin/readings/schedule', {
    schema: {
      tags: ['Admin'],
      summary: 'Schedule daily passage across multiple cohorts',
      description: 'Creates or updates daily readings for specified cohort group IDs across arbitrary cross-chapter ranges with JSONB verse exclusions in a single transaction.',
      body: {
        type: 'object',
        properties: {
          group_ids: { type: 'array', items: { type: 'number' }, example: [1, 2], description: 'Target cohort group IDs (1 to 7)' },
          scheduled_date: { type: 'string', format: 'date', example: '2026-09-21', description: 'Date (YYYY-MM-DD)' },
          book_number: { type: 'number', minimum: 1, maximum: 66, example: 66, description: 'Book ID (e.g. 1=Genesis, 19=Psalms, 43=John, 66=Revelation)' },
          start_chapter: { type: 'number', example: 1, description: 'Starting chapter' },
          start_verse: { type: 'number', example: 1, description: 'Starting verse' },
          end_chapter: { type: 'number', example: 1, description: 'Ending chapter (defaults to start_chapter if same chapter)' },
          end_verse: { type: 'number', example: 7, description: 'Ending verse' },
          excluded_verses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                chapter: { type: 'number', example: 1 },
                verse: { type: 'number', example: 4 }
              },
              required: ['chapter', 'verse']
            },
            example: [],
            description: 'Optional list of verses to exclude'
          },
          generate_ai_questions: {
            type: 'boolean',
            default: false,
            example: true,
            description: 'Toggle to automatically generate and attach age-appropriate AI comprehension question(s) for the reading'
          }
        },
        required: ['group_ids', 'scheduled_date', 'book_number', 'start_chapter', 'start_verse', 'end_verse']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            reading_ids: { type: 'array', items: { type: 'string' } }
          }
        },
        ...errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const parseResult = scheduleSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.flatten()
      });
    }

    const {
      group_ids,
      scheduled_date,
      book_number,
      start_chapter,
      start_verse,
      end_chapter,
      end_verse,
      excluded_verses,
      generate_ai_questions
    } = parseResult.data;

    // Validate range logic
    if (start_chapter > end_chapter || (start_chapter === end_chapter && start_verse > end_verse)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'start boundary cannot be after end boundary'
      });
    }

    // If AI generation toggle is on, extract verses once for the passage
    let verses: any[] = [];
    if (generate_ai_questions) {
      verses = await readingsService.extractVerses(
        book_number,
        start_chapter,
        start_verse,
        end_chapter,
        end_verse,
        excluded_verses
      );
    }

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const createdIds: string[] = [];

      for (const groupId of group_ids) {
        const res = await client.query(`
          INSERT INTO daily_readings (
            group_id, scheduled_date, book_number,
            start_chapter, start_verse, end_chapter, end_verse,
            excluded_verses
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (group_id, scheduled_date) 
          DO UPDATE SET
            book_number = EXCLUDED.book_number,
            start_chapter = EXCLUDED.start_chapter,
            start_verse = EXCLUDED.start_verse,
            end_chapter = EXCLUDED.end_chapter,
            end_verse = EXCLUDED.end_verse,
            excluded_verses = EXCLUDED.excluded_verses
          RETURNING id
        `, [
          groupId,
          scheduled_date,
          book_number,
          start_chapter,
          start_verse,
          end_chapter,
          end_verse,
          JSON.stringify(excluded_verses)
        ]);

        const readingId = res.rows[0].id;
        createdIds.push(readingId);

        if (generate_ai_questions && verses.length > 0) {
          // Look up grade bracket for this cohort
          const groupRes = await client.query('SELECT min_grade, max_grade FROM groups WHERE id = $1', [groupId]);
          const minGrade = groupRes.rows[0]?.min_grade ?? 5;
          const maxGrade = groupRes.rows[0]?.max_grade ?? 6;

          // Generate question tailored to this cohort's grade bracket using Gemini
          const aiQuestion = await aiQuestionService.generateQuestionForPassage(
            verses,
            minGrade,
            maxGrade,
            'mcq'
          );

          // Clear any previous auto-questions for this reading if rescheduling
          await client.query('DELETE FROM questions WHERE reading_id = $1', [readingId]);

          // Insert approved question
          await client.query(`
            INSERT INTO questions (
              reading_id, type, prompt_ar, prompt_en, options, correct_answer, points_value, sort_order, is_approved
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            readingId,
            aiQuestion.type,
            aiQuestion.prompt_ar,
            aiQuestion.prompt_en,
            JSON.stringify(aiQuestion.options),
            aiQuestion.correct_answer,
            10,
            1,
            true
          ]);
        }
      }

      await client.query('COMMIT');
      return reply.status(201).send({
        message: `Successfully scheduled reading for ${group_ids.length} groups` + (generate_ai_questions ? ' with AI-generated questions' : ''),
        reading_ids: createdIds
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      request.log.error(err);
      return reply.status(500).send({
        error: 'Database Error',
        message: 'Failed to schedule daily readings'
      });
    } finally {
      client.release();
    }
  });

  // 2. Commit Approved Questions to a Reading
  fastify.post('/admin/questions/commit', {
    schema: {
      tags: ['Admin'],
      summary: 'Commit approved questions for a reading',
      description: 'Saves an array of validated questions to the reading.',
      body: {
        type: 'object',
        properties: {
          reading_id: { type: 'string', description: 'Target Reading UUID or ID' },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['mcq', 'true_false', 'short_answer'] },
                prompt_ar: { type: 'string' },
                prompt_en: { type: 'string' },
                options: { type: 'object', additionalProperties: true },
                correct_answer: { type: 'string' },
                points_value: { type: 'number' },
                sort_order: { type: 'number' },
                is_approved: { type: 'boolean' }
              },
              required: ['prompt_ar', 'prompt_en', 'correct_answer']
            }
          }
        },
        required: ['reading_id', 'questions']
      },
      response: {
        201: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            question_ids: { type: 'array', items: { type: 'string' } }
          }
        },
        ...errorResponseSchema
      }
    }
  }, async (request, reply) => {
    const parseResult = commitQuestionsSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        details: parseResult.error.flatten()
      });
    }

    const { reading_id, questions } = parseResult.data;

    const client = await getClient();
    try {
      await client.query('BEGIN');
      const savedQuestionIds: string[] = [];

      for (const q of questions) {
        const res = await client.query(`
          INSERT INTO questions (
            reading_id, type, prompt_ar, prompt_en,
            options, correct_answer, points_value, sort_order, is_approved
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `, [
          reading_id,
          q.type,
          q.prompt_ar,
          q.prompt_en,
          JSON.stringify(q.options || null),
          q.correct_answer,
          q.points_value,
          q.sort_order,
          q.is_approved
        ]);
        savedQuestionIds.push(res.rows[0].id);
      }

      await client.query('COMMIT');
      return reply.status(201).send({
        message: `Committed ${savedQuestionIds.length} questions for reading`,
        question_ids: savedQuestionIds
      });
    } catch (err: any) {
      await client.query('ROLLBACK');
      request.log.error(err);
      return reply.status(500).send({
        error: 'Database Error',
        message: 'Failed to commit questions'
      });
    } finally {
      client.release();
    }
  });

  // 3. Daily Servant Roster Completion Report
  fastify.get('/servant/reports/daily', {
    schema: {
      tags: ['Admin'],
      summary: 'Get servant daily cohort roster completion report',
      description: 'Returns all students in a cohort, their points, current streaks, and daily question completion status.',
      querystring: {
        type: 'object',
        properties: {
          group_id: { type: 'string', description: 'Cohort ID (1 to 7)' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            group_id: { type: 'number' },
            report_date: { type: 'string' },
            total_students: { type: 'number' },
            completed_count: { type: 'number' },
            students: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  user_id: { type: 'string' },
                  full_name: { type: 'string' },
                  preferred_lang: { type: 'string' },
                  total_points: { type: 'number' },
                  current_streak: { type: 'number' },
                  points_earned_today: { type: 'number' },
                  completed_today: { type: 'boolean' },
                  questions_progress: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const queryParams = request.query as { group_id?: string; date?: string };
    const groupId = parseInt(queryParams.group_id || '1', 10);
    const date = queryParams.date || new Date().toISOString().split('T')[0];

    const usersRes = await query(`
      SELECT 
        u.id, u.full_name, u.preferred_lang, u.total_points, u.current_streak,
        dr.id AS reading_id,
        (
          SELECT COUNT(*) 
          FROM questions q 
          WHERE q.reading_id = dr.id AND q.is_approved = TRUE
        ) AS total_questions,
        (
          SELECT COUNT(*) 
          FROM submissions s 
          WHERE s.reading_id = dr.id AND s.user_id = u.id
        ) AS questions_answered,
        (
          SELECT COALESCE(SUM(s.points_awarded), 0)
          FROM submissions s 
          WHERE s.reading_id = dr.id AND s.user_id = u.id
        ) AS points_earned_today
      FROM users u
      LEFT JOIN daily_readings dr ON dr.group_id = u.group_id AND dr.scheduled_date = $2
      WHERE u.group_id = $1 AND u.role = 'kid' AND u.is_active = TRUE
      ORDER BY u.total_points DESC, u.full_name ASC
    `, [groupId, date]);

    const report = usersRes.rows.map(row => {
      const totalQ = parseInt(row.total_questions || '0', 10);
      const answeredQ = parseInt(row.questions_answered || '0', 10);
      return {
        user_id: row.id,
        full_name: row.full_name,
        preferred_lang: row.preferred_lang,
        total_points: row.total_points,
        current_streak: row.current_streak,
        points_earned_today: parseInt(row.points_earned_today, 10),
        completed_today: totalQ > 0 && answeredQ >= totalQ,
        questions_progress: `${answeredQ}/${totalQ}`
      };
    });

    return {
      group_id: groupId,
      report_date: date,
      total_students: report.length,
      completed_count: report.filter(r => r.completed_today).length,
      students: report
    };
  });
}
