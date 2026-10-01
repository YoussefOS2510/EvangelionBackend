import { FastifyInstance } from 'fastify';
import { readingsService } from './readings.service.js';

const localizedReadingResponseSchema = (lang: 'ar' | 'en') => ({
  200: {
    type: 'object',
    properties: {
      reading_id: { type: 'string' },
      group_id: { type: 'number' },
      scheduled_date: { type: 'string' },
      language: { type: 'string', example: lang },
      reference: { type: 'string', example: lang === 'ar' ? 'الرؤيا 1: 1-7' : 'Revelation 1:1-7' },
      translation: { type: 'string', example: lang === 'ar' ? 'Smith & Van Dyck (فانديك)' : 'NKJV (New King James Version)' },
      verses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            book_number: { type: 'number' },
            chapter: { type: 'number' },
            verse: { type: 'number' },
            text: { type: 'string' },
            ...(lang === 'ar' ? { text_clean: { type: 'string' } } : {})
          }
        }
      },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            sort_order: { type: 'number' },
            type: { type: 'string' },
            prompt: { type: 'string' },
            options: { type: 'object', additionalProperties: { type: 'string' } },
            points_value: { type: 'number' },
            already_answered: { type: 'boolean' },
            user_answer: { type: 'string', nullable: true },
            is_correct: { type: 'boolean', nullable: true }
          }
        }
      },
      is_fully_completed: { type: 'boolean' },
      total_points_earned_today: { type: 'number' },
      current_streak: { type: 'number' }
    }
  },
  '4xx': {
    type: 'object',
    properties: {
      error: { type: 'string' },
      message: { type: 'string' }
    }
  },
  '5xx': {
    type: 'object',
    properties: {
      error: { type: 'string' },
      message: { type: 'string' }
    }
  }
});

const localizedBibleResponseSchema = (lang: 'ar' | 'en') => ({
  200: {
    type: 'object',
    properties: {
      language: { type: 'string', example: lang },
      book_number: { type: 'number' },
      book_name: { type: 'string' },
      reference: { type: 'string', example: lang === 'ar' ? 'الرؤيا 1: 1-7' : 'Revelation 1:1-7' },
      translation: { type: 'string', example: lang === 'ar' ? 'Smith & Van Dyck (فانديك)' : 'NKJV (New King James Version)' },
      verse_count: { type: 'number' },
      verses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            chapter: { type: 'number' },
            verse: { type: 'number' },
            text: { type: 'string' },
            ...(lang === 'ar' ? { text_clean: { type: 'string' } } : {})
          }
        }
      }
    }
  },
  '4xx': {
    type: 'object',
    properties: {
      error: { type: 'string' },
      message: { type: 'string' }
    }
  }
});

const biblePassageQuerySchema = {
  type: 'object',
  required: ['book_number', 'start_chapter', 'start_verse', 'end_verse'],
  properties: {
    book_number: { type: 'number', minimum: 1, maximum: 66, example: 66, description: 'Book ID (1-66)' },
    start_chapter: { type: 'number', example: 1, description: 'Starting chapter' },
    start_verse: { type: 'number', example: 1, description: 'Starting verse' },
    end_chapter: { type: 'number', example: 1, description: 'Ending chapter (defaults to start_chapter)' },
    end_verse: { type: 'number', example: 7, description: 'Ending verse' }
  }
};

export async function readingsRoutes(fastify: FastifyInstance) {
  // Common handler helper for reading fetching
  async function resolveReading(request: any, reply: any) {
    const user = (request as any).user;
    const groupId = user?.groupId || parseInt(request.headers['x-group-id'] as string, 10);
    const userId = user?.id || (request.headers['x-user-id'] as string);

    if (!groupId) {
      reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing group identification (X-Group-Id header or user profile)'
      });
      return null;
    }

    const queryDate = (request.query as any)?.date;
    const todayReading = await readingsService.getTodayReadingForGroup(groupId, userId, queryDate);
    if (!todayReading) {
      reply.status(404).send({
        error: 'Not Found',
        message: 'No scheduled reading found for your cohort today'
      });
      return null;
    }

    return todayReading;
  }

  // 1. Dedicated Arabic Daily Reading Endpoint
  fastify.get('/readings/today/ar', {
    schema: {
      tags: ['Readings'],
      summary: 'Get daily scripture passage and questions in Arabic (Smith & Van Dyck)',
      description: 'Returns Arabic daily reading with vocalized Arabic text (tashkeel), diacritic-stripped search text, Arabic reference, and Arabic comprehension questions.',
      headers: {
        type: 'object',
        properties: {
          'x-group-id': { type: 'string', description: 'Cohort Group ID (1 to 7)' },
          'x-user-id': { type: 'string', description: 'Optional Student UUID to check submission status' }
        },
        required: ['x-group-id']
      },
      querystring: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date', description: 'Optional date override (YYYY-MM-DD)' }
        }
      },
      response: localizedReadingResponseSchema('ar')
    }
  }, async (request, reply) => {
    const reading = await resolveReading(request, reply);
    if (!reading) return;
    return readingsService.formatLocalizedReading(reading, 'ar');
  });

  // 2. Dedicated English Daily Reading Endpoint
  fastify.get('/readings/today/en', {
    schema: {
      tags: ['Readings'],
      summary: 'Get daily scripture passage and questions in English (NKJV / KJV)',
      description: 'Returns English daily reading with English text, English reference, and English comprehension questions.',
      headers: {
        type: 'object',
        properties: {
          'x-group-id': { type: 'string', description: 'Cohort Group ID (1 to 7)' },
          'x-user-id': { type: 'string', description: 'Optional Student UUID to check submission status' }
        },
        required: ['x-group-id']
      },
      querystring: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date', description: 'Optional date override (YYYY-MM-DD)' }
        }
      },
      response: localizedReadingResponseSchema('en')
    }
  }, async (request, reply) => {
    const reading = await resolveReading(request, reply);
    if (!reading) return;
    return readingsService.formatLocalizedReading(reading, 'en');
  });

  // 3. Default Bilingual Reading Endpoint (with optional ?lang=ar|en filter)
  fastify.get('/readings/today', {
    schema: {
      tags: ['Readings'],
      summary: 'Get daily scripture passage and questions (Bilingual or Localized via ?lang=)',
      description: 'Returns bilingual passage verses (Van Dyck and NKJV) along with today’s comprehension questions. Pass ?lang=ar or ?lang=en to filter.',
      headers: {
        type: 'object',
        properties: {
          'x-group-id': { type: 'string', description: 'Cohort Group ID (1 to 7)' },
          'x-user-id': { type: 'string', description: 'Optional Student UUID to check submission status' }
        },
        required: ['x-group-id']
      },
      querystring: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date', description: 'Optional date override (YYYY-MM-DD)' },
          lang: { type: 'string', enum: ['ar', 'en'], description: 'Optional language filter (ar or en)' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            reading_id: { type: 'string' },
            group_id: { type: 'number' },
            scheduled_date: { type: 'string' },
            language: { type: 'string' },
            reference: { type: ['object', 'string'], additionalProperties: true },
            translation: { type: ['object', 'string'], additionalProperties: true },
            verses: { type: 'array', items: { type: 'object', additionalProperties: true } },
            questions: { type: 'array', items: { type: 'object', additionalProperties: true } },
            is_fully_completed: { type: 'boolean' },
            total_points_earned_today: { type: 'number' },
            current_streak: { type: 'number' }
          }
        },
        '4xx': {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        '5xx': {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const reading = await resolveReading(request, reply);
    if (!reading) return;

    const lang = (request.query as any)?.lang;
    if (lang === 'ar' || lang === 'en') {
      return readingsService.formatLocalizedReading(reading, lang);
    }
    return reading;
  });

  // 4. Dedicated Arabic Bible Scripture Passage Lookup
  fastify.get('/bible/verses/ar', {
    schema: {
      tags: ['Bible'],
      summary: 'Read Scripture passage in Arabic (Smith & Van Dyck)',
      description: 'Directly extract verses for any book, chapter, and verse range in Arabic with vocalized and clean text.',
      querystring: biblePassageQuerySchema,
      response: localizedBibleResponseSchema('ar')
    }
  }, async (request, reply) => {
    const q = request.query as any;
    const bookNumber = parseInt(q.book_number, 10);
    const startChapter = parseInt(q.start_chapter, 10);
    const startVerse = parseInt(q.start_verse, 10);
    const endChapter = q.end_chapter ? parseInt(q.end_chapter, 10) : startChapter;
    const endVerse = parseInt(q.end_verse, 10);

    const bookNames = await readingsService.getBookNames(bookNumber);
    const verses = await readingsService.extractVerses(bookNumber, startChapter, startVerse, endChapter, endVerse);

    const ref = startChapter === endChapter
      ? `${bookNames.ar} ${startChapter}: ${startVerse}-${endVerse}`
      : `${bookNames.ar} ${startChapter}: ${startVerse} - ${endChapter}: ${endVerse}`;

    return {
      language: 'ar',
      book_number: bookNumber,
      book_name: bookNames.ar,
      reference: ref,
      translation: 'Smith & Van Dyck (فانديك)',
      verse_count: verses.length,
      verses: verses.map(v => ({
        chapter: v.chapter,
        verse: v.verse,
        text: v.text_ar,
        text_clean: v.text_ar_clean
      }))
    };
  });

  // 5. Dedicated English Bible Scripture Passage Lookup
  fastify.get('/bible/verses/en', {
    schema: {
      tags: ['Bible'],
      summary: 'Read Scripture passage in English (King James Version)',
      description: 'Directly extract verses for any book, chapter, and verse range in English.',
      querystring: biblePassageQuerySchema,
      response: localizedBibleResponseSchema('en')
    }
  }, async (request, reply) => {
    const q = request.query as any;
    const bookNumber = parseInt(q.book_number, 10);
    const startChapter = parseInt(q.start_chapter, 10);
    const startVerse = parseInt(q.start_verse, 10);
    const endChapter = q.end_chapter ? parseInt(q.end_chapter, 10) : startChapter;
    const endVerse = parseInt(q.end_verse, 10);

    const bookNames = await readingsService.getBookNames(bookNumber);
    const verses = await readingsService.extractVerses(bookNumber, startChapter, startVerse, endChapter, endVerse);

    const ref = startChapter === endChapter
      ? `${bookNames.en} ${startChapter}:${startVerse}-${endVerse}`
      : `${bookNames.en} ${startChapter}:${startVerse} - ${endChapter}:${endVerse}`;

    return {
      language: 'en',
      book_number: bookNumber,
      book_name: bookNames.en,
      reference: ref,
      translation: 'NKJV (New King James Version)',
      verse_count: verses.length,
      verses: verses.map(v => ({
        chapter: v.chapter,
        verse: v.verse,
        text: v.text_en
      }))
    };
  });

  // 6. Bilingual Scripture Passage Lookup
  fastify.get('/bible/verses', {
    schema: {
      tags: ['Bible'],
      summary: 'Read Scripture passage (Bilingual)',
      description: 'Directly extract verses for any book, chapter, and verse range with both Arabic and English text.',
      querystring: biblePassageQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            book_number: { type: 'number' },
            reference: {
              type: 'object',
              properties: {
                ar: { type: 'string' },
                en: { type: 'string' }
              }
            },
            translation: {
              type: 'object',
              properties: {
                ar: { type: 'string' },
                en: { type: 'string' }
              }
            },
            verse_count: { type: 'number' },
            verses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  book_number: { type: 'number' },
                  chapter: { type: 'number' },
                  verse: { type: 'number' },
                  text_ar: { type: 'string' },
                  text_ar_clean: { type: 'string' },
                  text_en: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const q = request.query as any;
    const bookNumber = parseInt(q.book_number, 10);
    const startChapter = parseInt(q.start_chapter, 10);
    const startVerse = parseInt(q.start_verse, 10);
    const endChapter = q.end_chapter ? parseInt(q.end_chapter, 10) : startChapter;
    const endVerse = parseInt(q.end_verse, 10);

    const bookNames = await readingsService.getBookNames(bookNumber);
    const verses = await readingsService.extractVerses(bookNumber, startChapter, startVerse, endChapter, endVerse);

    const refEn = startChapter === endChapter
      ? `${bookNames.en} ${startChapter}:${startVerse}-${endVerse}`
      : `${bookNames.en} ${startChapter}:${startVerse} - ${endChapter}:${endVerse}`;

    const refAr = startChapter === endChapter
      ? `${bookNames.ar} ${startChapter}: ${startVerse}-${endVerse}`
      : `${bookNames.ar} ${startChapter}: ${startVerse} - ${endChapter}: ${endVerse}`;

    return {
      book_number: bookNumber,
      reference: { ar: refAr, en: refEn },
      translation: {
        ar: 'Smith & Van Dyck (فانديك)',
        en: 'NKJV (New King James Version)'
      },
      verse_count: verses.length,
      verses
    };
  });
}
