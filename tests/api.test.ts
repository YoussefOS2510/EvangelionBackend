import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/app.js';
import { FastifyInstance } from 'fastify';

describe('Fastify API Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns status ok', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.status).toBe('ok');
    expect(json.service).toContain('Evangelion');
  });

  it('GET /api/v1/readings/today returns 400 when missing group header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/readings/today'
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.message).toContain('x-group-id');
  });

  it('GET /api/v1/leaderboard returns ranking structure', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/leaderboard?window=weekly',
      headers: {
        'x-group-id': '3',
        'x-user-id': '11111111-1111-1111-1111-111111111111'
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.group_id).toBe(3);
    expect(json.window).toBe('weekly');
    expect(Array.isArray(json.leaderboard)).toBe(true);
  });

  it('POST /api/v1/admin/readings/schedule rejects invalid range', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/readings/schedule',
      payload: {
        group_ids: [1, 2],
        scheduled_date: '2026-10-15',
        book_number: 43,
        start_chapter: 3,
        start_verse: 10,
        end_chapter: 3,
        end_verse: 5 // End verse earlier than start verse!
      }
    });

    expect(res.statusCode).toBe(400);
    const json = JSON.parse(res.body);
    expect(json.message).toContain('start boundary cannot be after end boundary');
  });

  it('GET /docs returns Swagger UI HTML', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/docs/'
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('GET /docs/json returns OpenAPI specification', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/docs/json'
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.openapi).toBeDefined();
    expect(json.info.title).toContain('Evangelion');
  });

  it('GET /api/v1/readings/today/ar returns localized Arabic reading', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/readings/today/ar',
      headers: {
        'x-group-id': '1',
        'x-user-id': '11111111-1111-1111-1111-111111111111'
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.language).toBe('ar');
    expect(json.translation).toContain('فانديك');
    expect(typeof json.reference).toBe('string');
    expect(json.verses[0].text).toBeDefined();
    expect(json.verses[0].text_clean).toBeDefined();
    expect(json.questions[0].prompt).toBeDefined();
  });

  it('GET /api/v1/readings/today/en returns localized English reading', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/readings/today/en',
      headers: {
        'x-group-id': '1',
        'x-user-id': '11111111-1111-1111-1111-111111111111'
      }
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.body);
    expect(json.language).toBe('en');
    expect(json.translation).toContain('King James');
    expect(typeof json.reference).toBe('string');
    expect(json.verses[0].text).toBeDefined();
    expect(json.questions[0].prompt).toBeDefined();
  });

  it('GET /api/v1/bible/verses/ar and /en extracts localized scripture passages', async () => {
    const arRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bible/verses/ar?book_number=66&start_chapter=1&start_verse=1&end_verse=3'
    });
    expect(arRes.statusCode).toBe(200);
    const arJson = JSON.parse(arRes.body);
    expect(arJson.language).toBe('ar');
    expect(arJson.verse_count).toBe(3);
    expect(arJson.reference).toContain('الرؤيا 1: 1-3');
    expect(arJson.verses[0].text_clean).toBeDefined();

    const enRes = await app.inject({
      method: 'GET',
      url: '/api/v1/bible/verses/en?book_number=66&start_chapter=1&start_verse=1&end_verse=3'
    });
    expect(enRes.statusCode).toBe(200);
    const enJson = JSON.parse(enRes.body);
    expect(enJson.language).toBe('en');
    expect(enJson.verse_count).toBe(3);
    expect(enJson.reference).toBe('Revelation 1:1-3');
    expect(enJson.verses[0].text).toContain('Revelation');
  });
});

