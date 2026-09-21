import { describe, it, expect, beforeEach } from 'vitest';
import { LeaderboardService } from '../src/redis/leaderboard.service.js';

describe('Multi-Window Leaderboard Service', () => {
  let service: LeaderboardService;

  beforeEach(() => {
    // Uses in-memory Redis fallback during tests
    service = new LeaderboardService();
  });

  it('generates correct ISO format for weekly and monthly keys', () => {
    const testDate = new Date('2026-10-15T12:00:00Z');
    const month = LeaderboardService.getYearMonth(testDate);
    const week = LeaderboardService.getYearWeek(testDate);

    expect(month).toBe('2026-10');
    expect(week).toBe('2026-42');

    const weeklyKey = LeaderboardService.getKey(3, 'weekly', testDate);
    const monthlyKey = LeaderboardService.getKey(3, 'monthly', testDate);
    const allTimeKey = LeaderboardService.getKey(3, 'all_time', testDate);

    expect(weeklyKey).toBe('leaderboard:group:3:weekly:2026-42');
    expect(monthlyKey).toBe('leaderboard:group:3:monthly:2026-10');
    expect(allTimeKey).toBe('leaderboard:group:3:all_time');
  });

  it('atomically records scores across all three time windows', async () => {
    const testDate = new Date('2026-10-15T12:00:00Z');
    const groupId = 3;
    const user1 = 'kid-alice';
    const user2 = 'kid-bob';

    // Record scores
    await service.recordScore(groupId, user1, 10, testDate);
    await service.recordScore(groupId, user1, 10, testDate);
    await service.recordScore(groupId, user2, 10, testDate);

    // Verify weekly leaderboard
    const weeklyBoard = await service.getLeaderboard(groupId, 'weekly', 10, testDate);
    expect(weeklyBoard.length).toBe(2);
    expect(weeklyBoard[0]).toEqual({ userId: user1, score: 20, rank: 1 });
    expect(weeklyBoard[1]).toEqual({ userId: user2, score: 10, rank: 2 });

    // Verify monthly leaderboard
    const monthlyBoard = await service.getLeaderboard(groupId, 'monthly', 10, testDate);
    expect(monthlyBoard[0].userId).toBe(user1);
    expect(monthlyBoard[0].score).toBe(20);

    // Verify all-time leaderboard
    const allTimeBoard = await service.getLeaderboard(groupId, 'all_time', 10, testDate);
    expect(allTimeBoard[0].userId).toBe(user1);
    expect(allTimeBoard[0].score).toBe(20);

    // Check individual standing
    const standing1 = await service.getUserStanding(groupId, user1, 'weekly', testDate);
    expect(standing1).toEqual({ rank: 1, score: 20 });

    const standing2 = await service.getUserStanding(groupId, user2, 'weekly', testDate);
    expect(standing2).toEqual({ rank: 2, score: 10 });
  });

  it('handles unknown users gracefully with null rank and zero score', async () => {
    const standing = await service.getUserStanding(99, 'non-existent-user', 'weekly');
    expect(standing).toEqual({ rank: null, score: 0 });
  });
});
