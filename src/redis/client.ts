import { Redis } from 'ioredis';
import { config } from '../config/env.js';

export class InMemoryRedisFallback {
  private zsets = new Map<string, Map<string, number>>();

  constructor(seed: boolean = process.env.NODE_ENV !== 'test') {
    if (!seed) return;
    // Pre-seed sample weekly, monthly, and all-time scores for Group 3 demo
    const yyyyMm = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const d = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const yyyyWw = `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;

    const seedUsers = [
      { id: '22222222-2222-2222-2222-222222222222', score: 80 },
      { id: '11111111-1111-1111-1111-111111111111', score: 50 },
      { id: '33333333-3333-3333-3333-333333333333', score: 30 }
    ];

    for (const prefix of [
      `leaderboard:group:3:weekly:${yyyyWw}`,
      `leaderboard:group:3:monthly:${yyyyMm}`,
      `leaderboard:group:3:all_time`
    ]) {
      const map = new Map<string, number>();
      for (const u of seedUsers) {
        map.set(u.id, u.score);
      }
      this.zsets.set(prefix, map);
    }
  }

  async zincrby(key: string, increment: number, member: string): Promise<string> {
    if (!this.zsets.has(key)) {
      this.zsets.set(key, new Map());
    }
    const zset = this.zsets.get(key)!;
    const current = zset.get(member) || 0;
    const updated = current + increment;
    zset.set(member, updated);
    return updated.toString();
  }

  async zrevrange(key: string, start: number, stop: number, withScores?: string): Promise<string[]> {
    const zset = this.zsets.get(key);
    if (!zset) return [];
    const entries = Array.from(zset.entries()).sort((a, b) => b[1] - a[1]);
    const sliced = entries.slice(start, stop === -1 ? undefined : stop + 1);
    if (withScores === 'WITHSCORES') {
      const result: string[] = [];
      for (const [member, score] of sliced) {
        result.push(member, score.toString());
      }
      return result;
    }
    return sliced.map(([member]) => member);
  }

  async zrevrank(key: string, member: string): Promise<number | null> {
    const zset = this.zsets.get(key);
    if (!zset || !zset.has(member)) return null;
    const entries = Array.from(zset.entries()).sort((a, b) => b[1] - a[1]);
    const rank = entries.findIndex(([m]) => m === member);
    return rank >= 0 ? rank : null;
  }

  async zscore(key: string, member: string): Promise<string | null> {
    const zset = this.zsets.get(key);
    if (!zset || !zset.has(member)) return null;
    return zset.get(member)!.toString();
  }

  pipeline() {
    const operations: Array<() => Promise<any>> = [];
    const pipe = {
      zincrby: (key: string, inc: number, member: string) => {
        operations.push(() => this.zincrby(key, inc, member));
        return pipe;
      },
      exec: async () => {
        const results = [];
        for (const op of operations) {
          results.push([null, await op()]);
        }
        return results;
      }
    };
    return pipe;
  }

  async flushall() {
    this.zsets.clear();
  }
}

export type RedisLike = {
  zincrby(key: string, increment: number, member: string): Promise<string>;
  zrevrange(key: string, start: number, stop: number, withScores?: string): Promise<string[]>;
  zrevrank(key: string, member: string): Promise<number | null>;
  zscore(key: string, member: string): Promise<string | null>;
  pipeline(): any;
};

class ResilientRedisClient implements RedisLike {
  private fallback = new InMemoryRedisFallback();
  private realClient: Redis | null = null;
  private isConnected = false;
  private logged = false;

  constructor() {
    if (process.env.NODE_ENV === 'test' || process.env.USE_IN_MEMORY_REDIS === 'true') {
      return;
    }

    try {
      this.realClient = new Redis(config.redis.url, {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        connectTimeout: 1000,
        lazyConnect: false
      });

      this.realClient.on('connect', () => {
        this.isConnected = true;
      });

      this.realClient.on('error', () => {
        this.isConnected = false;
        if (!this.logged) {
          console.warn('⚠️ [Redis Fallback] Redis offline at localhost:6379 - using active in-memory leaderboard store.');
          this.logged = true;
        }
      });
    } catch {
      this.isConnected = false;
    }
  }

  async zincrby(key: string, increment: number, member: string): Promise<string> {
    if (this.isConnected && this.realClient) {
      try {
        return await this.realClient.zincrby(key, increment, member);
      } catch {
        this.isConnected = false;
      }
    }
    return this.fallback.zincrby(key, increment, member);
  }

  async zrevrange(key: string, start: number, stop: number, withScores?: string): Promise<string[]> {
    if (this.isConnected && this.realClient) {
      try {
        return withScores
          ? await this.realClient.zrevrange(key, start, stop, withScores as any)
          : await this.realClient.zrevrange(key, start, stop);
      } catch {
        this.isConnected = false;
      }
    }
    return this.fallback.zrevrange(key, start, stop, withScores);
  }

  async zrevrank(key: string, member: string): Promise<number | null> {
    if (this.isConnected && this.realClient) {
      try {
        return await this.realClient.zrevrank(key, member);
      } catch {
        this.isConnected = false;
      }
    }
    return this.fallback.zrevrank(key, member);
  }

  async zscore(key: string, member: string): Promise<string | null> {
    if (this.isConnected && this.realClient) {
      try {
        return await this.realClient.zscore(key, member);
      } catch {
        this.isConnected = false;
      }
    }
    return this.fallback.zscore(key, member);
  }

  pipeline() {
    if (this.isConnected && this.realClient) {
      return this.realClient.pipeline();
    }
    return this.fallback.pipeline();
  }
}

let redisInstance: RedisLike;

export function getRedisClient(): RedisLike {
  if (!redisInstance) {
    redisInstance = new ResilientRedisClient();
  }
  return redisInstance;
}

export const redis = getRedisClient();
