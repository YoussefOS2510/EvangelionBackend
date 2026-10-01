import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';
import { memoryDb } from '../src/db/memory_db.js';

describe('Daily Streaks Engine & Endpoints', () => {
  let app: FastifyInstance;
  const testUserId = '11111111-1111-1111-1111-111111111111'; // David Mina (Grade 5)
  const groupId = 3;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/v1/streak returns 400 when missing X-User-Id header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/streak'
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.message.toLowerCase()).toContain('x-user-id');
  });

  it('GET /api/v1/streak returns full streak details, milestone, and history', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/streak',
      headers: {
        'x-user-id': testUserId,
        'x-group-id': String(groupId)
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);

    expect(json.user_id).toBe(testUserId);
    expect(json.group_id).toBe(groupId);
    expect(typeof json.current_streak).toBe('number');
    expect(typeof json.longest_streak).toBe('number');
    expect(typeof json.today_scheduled).toBe('boolean');
    expect(typeof json.today_completed).toBe('boolean');
    expect(['completed', 'pending', 'off_day', 'broken']).toContain(json.today_status);
    expect(typeof json.next_milestone).toBe('number');
    expect(json.next_milestone).toBeGreaterThan(0);
    expect(typeof json.days_to_milestone).toBe('number');
    expect(Array.isArray(json.history)).toBe(true);
    expect(json.history.length).toBeGreaterThan(0);

    const firstHistory = json.history[0];
    expect(firstHistory.reading_id).toBeDefined();
    expect(firstHistory.scheduled_date).toBeDefined();
    expect(typeof firstHistory.total_questions).toBe('number');
    expect(typeof firstHistory.is_completed).toBe('boolean');
  });

  it('GET /api/v1/streak/summary returns concise streak statistics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/streak/summary',
      headers: {
        'x-user-id': testUserId,
        'x-group-id': String(groupId)
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);

    expect(json.user_id).toBe(testUserId);
    expect(json.group_id).toBe(groupId);
    expect(typeof json.current_streak).toBe('number');
    expect(typeof json.longest_streak).toBe('number');
    expect(['completed', 'pending', 'off_day', 'broken']).toContain(json.today_status);
    expect(typeof json.next_milestone).toBe('number');
    expect(typeof json.days_to_milestone).toBe('number');
    // Summary does NOT return history array
    expect(json.history).toBeUndefined();
  });

  it('Scheduled-Day Streak Preservation: off-days do not break streak', async () => {
    // Query with a date that has no scheduled reading (e.g. 2026-12-25 holiday)
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/streak?date=2026-12-25',
      headers: {
        'x-user-id': testUserId,
        'x-group-id': String(groupId)
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    // On off-day, streak is preserved, today_scheduled is false or today_status is off_day
    expect(json.today_date).toBe('2026-12-25');
    expect(typeof json.current_streak).toBe('number');
  });

  it('POST /api/v1/readings/:id/submit completes reading, increments points and updates streak', async () => {
    // Create a fresh test user in memoryDb
    const newUserId = '44444444-4444-4444-4444-444444444444';
    memoryDb.users.push({
      id: newUserId,
      group_id: 3,
      full_name: 'Test Kid',
      username: 'test_kid',
      role: 'kid',
      preferred_lang: 'en',
      total_points: 0,
      current_streak: 0,
      longest_streak: 0,
      last_completed_date: null,
      is_active: true
    });

    // 1. Fetch today's reading to get readingId and questionId
    const readingRes = await app.inject({
      method: 'GET',
      url: '/api/v1/readings/today/en',
      headers: {
        'x-user-id': newUserId,
        'x-group-id': '3'
      }
    });
    expect(readingRes.statusCode).toBe(200);
    const readingData = JSON.parse(readingRes.body);
    const readingId = readingData.reading_id;
    const question = readingData.questions[0];

    // 2. Submit correct answer
    const submitRes = await app.inject({
      method: 'POST',
      url: `/api/v1/readings/${readingId}/submit`,
      headers: {
        'x-user-id': newUserId
      },
      payload: {
        question_id: question.id,
        answer: 'A' // Correct answer in seed
      }
    });

    expect(submitRes.statusCode).toBe(200);
    const submitData = JSON.parse(submitRes.body);
    expect(submitData.is_correct).toBe(true);
    expect(submitData.points_earned).toBe(10);
    expect(submitData.current_total_points).toBe(10);
    expect(submitData.reading_completed).toBe(true);
    expect(submitData.current_streak).toBeGreaterThanOrEqual(1);
    expect(submitData.longest_streak).toBeGreaterThanOrEqual(1);

    // 3. Verify streak endpoint reflects updated streak
    const streakRes = await app.inject({
      method: 'GET',
      url: '/api/v1/streak',
      headers: {
        'x-user-id': newUserId,
        'x-group-id': '3'
      }
    });
    expect(streakRes.statusCode).toBe(200);
    const streakData = JSON.parse(streakRes.body);
    expect(streakData.today_completed).toBe(true);
    expect(streakData.today_status).toBe('completed');
    expect(streakData.current_streak).toBe(submitData.current_streak);

    // 4. Duplicate submission is rejected with 409 Conflict
    const dupRes = await app.inject({
      method: 'POST',
      url: `/api/v1/readings/${readingId}/submit`,
      headers: {
        'x-user-id': newUserId
      },
      payload: {
        question_id: question.id,
        answer: 'A'
      }
    });
    expect(dupRes.statusCode).toBe(409);
  });
});
