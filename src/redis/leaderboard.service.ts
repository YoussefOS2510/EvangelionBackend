import { redis, RedisLike } from './client.js';

export type LeaderboardWindow = 'weekly' | 'monthly' | 'all_time';

export interface LeaderboardEntry {
  userId: string;
  score: number;
  rank: number;
}

export class LeaderboardService {
  constructor(private client: RedisLike = redis) {}

  static getYearMonth(date: Date = new Date()): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  }

  static getYearWeek(date: Date = new Date()): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
  }

  static getKey(groupId: number, window: LeaderboardWindow, date: Date = new Date()): string {
    if (window === 'all_time') {
      return `leaderboard:group:${groupId}:all_time`;
    }
    if (window === 'monthly') {
      return `leaderboard:group:${groupId}:monthly:${LeaderboardService.getYearMonth(date)}`;
    }
    return `leaderboard:group:${groupId}:weekly:${LeaderboardService.getYearWeek(date)}`;
  }

  async recordScore(groupId: number, userId: string, points: number, date: Date = new Date()): Promise<void> {
    const allTimeKey = LeaderboardService.getKey(groupId, 'all_time', date);
    const monthlyKey = LeaderboardService.getKey(groupId, 'monthly', date);
    const weeklyKey = LeaderboardService.getKey(groupId, 'weekly', date);

    const pipe = this.client.pipeline();
    pipe.zincrby(allTimeKey, points, userId);
    pipe.zincrby(monthlyKey, points, userId);
    pipe.zincrby(weeklyKey, points, userId);
    await pipe.exec();
  }

  async getLeaderboard(
    groupId: number,
    window: LeaderboardWindow = 'weekly',
    limit: number = 50,
    date: Date = new Date()
  ): Promise<LeaderboardEntry[]> {
    const key = LeaderboardService.getKey(groupId, window, date);
    const raw = await this.client.zrevrange(key, 0, limit - 1, 'WITHSCORES');
    
    const entries: LeaderboardEntry[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      entries.push({
        userId: raw[i],
        score: parseInt(raw[i + 1], 10),
        rank: Math.floor(i / 2) + 1
      });
    }
    return entries;
  }

  async getUserStanding(
    groupId: number,
    userId: string,
    window: LeaderboardWindow = 'weekly',
    date: Date = new Date()
  ): Promise<{ rank: number | null; score: number }> {
    const key = LeaderboardService.getKey(groupId, window, date);
    const [rawRank, rawScore] = await Promise.all([
      this.client.zrevrank(key, userId),
      this.client.zscore(key, userId)
    ]);

    return {
      rank: rawRank !== null ? rawRank + 1 : null,
      score: rawScore ? parseInt(rawScore, 10) : 0
    };
  }

  async warmCache(groupId: number, window: LeaderboardWindow, entries: { userId: string; score: number }[], date: Date = new Date()): Promise<void> {
    const key = LeaderboardService.getKey(groupId, window, date);
    const pipe = this.client.pipeline();
    for (const entry of entries) {
      pipe.zincrby(key, entry.score, entry.userId);
    }
    await pipe.exec();
  }
}

export const leaderboardService = new LeaderboardService();
