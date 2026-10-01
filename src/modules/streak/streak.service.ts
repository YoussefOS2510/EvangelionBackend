import { query } from '../../db/pool.js';

export type TodayStreakStatus = 'completed' | 'pending' | 'off_day' | 'broken';

export interface ScheduledDayHistoryItem {
  reading_id: string;
  scheduled_date: string;
  book_number: number;
  book_name_en?: string;
  book_name_ar?: string;
  reference?: { ar: string; en: string };
  total_questions: number;
  answered_questions: number;
  correct_answers: number;
  points_earned: number;
  is_completed: boolean;
}

export interface UserStreakDetails {
  user_id: string;
  group_id: number;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  today_date: string;
  today_scheduled: boolean;
  today_completed: boolean;
  today_status: TodayStreakStatus;
  next_milestone: number;
  days_to_milestone: number;
  history: ScheduledDayHistoryItem[];
}

export interface StreakSummary {
  user_id: string;
  group_id: number;
  current_streak: number;
  longest_streak: number;
  last_completed_date: string | null;
  today_status: TodayStreakStatus;
  today_completed: boolean;
  today_scheduled: boolean;
  next_milestone: number;
  days_to_milestone: number;
}

const MILESTONES = [3, 7, 14, 21, 30, 50, 100, 180, 365];

export class StreakService {
  /**
   * Calculates the nearest upcoming milestone streak
   */
  private getNextMilestone(streak: number): { nextMilestone: number; daysToMilestone: number } {
    for (const m of MILESTONES) {
      if (streak < m) {
        return { nextMilestone: m, daysToMilestone: m - streak };
      }
    }
    const next = streak + 50;
    return { nextMilestone: next, daysToMilestone: 50 };
  }

  /**
   * Retrieves full streak details and calendar history for a student
   */
  async getUserStreak(userId: string, groupId?: number, targetDate?: string): Promise<UserStreakDetails> {
    const today = targetDate || new Date().toISOString().split('T')[0];

    // 1. Get user profile
    const uRes = await query(
      'SELECT id, group_id, current_streak, longest_streak, last_completed_date FROM users WHERE id = $1',
      [userId]
    );

    if (uRes.rows.length === 0) {
      throw new Error(`USER_NOT_FOUND: User with ID ${userId} does not exist.`);
    }

    const user = uRes.rows[0];
    const effectiveGroupId = groupId || user.group_id;

    if (!effectiveGroupId) {
      throw new Error(`GROUP_NOT_FOUND: User ${userId} is not assigned to a cohort.`);
    }

    // 2. Fetch scheduled readings for this group up to targetDate (up to past 30 scheduled readings)
    const scheduleRes = await query(`
      SELECT 
        dr.id, dr.scheduled_date, dr.book_number,
        dr.start_chapter, dr.start_verse, dr.end_chapter, dr.end_verse
      FROM daily_readings dr
      WHERE dr.group_id = $1 AND dr.scheduled_date <= $2
      ORDER BY dr.scheduled_date DESC
      LIMIT 30
    `, [effectiveGroupId, today]);

    // 3. For each reading, inspect questions count and submissions count
    const history: ScheduledDayHistoryItem[] = [];
    for (const row of scheduleRes.rows) {
      const statsRes = await query(`
        SELECT 
          (SELECT COUNT(*) FROM questions q WHERE q.reading_id = $1 AND q.is_approved = TRUE) AS total_q,
          (SELECT COUNT(*) FROM submissions s WHERE s.reading_id = $1 AND s.user_id = $2) AS answered_q,
          (SELECT COUNT(*) FROM submissions s WHERE s.reading_id = $1 AND s.user_id = $2 AND s.is_correct = TRUE) AS correct_q,
          (SELECT COALESCE(SUM(s.points_awarded), 0) FROM submissions s WHERE s.reading_id = $1 AND s.user_id = $2) AS pts
      `, [row.id, userId]);

      const totalQ = parseInt(statsRes.rows[0]?.total_q || '0', 10);
      const answeredQ = parseInt(statsRes.rows[0]?.answered_q || '0', 10);
      const correctQ = parseInt(statsRes.rows[0]?.correct_q || '0', 10);
      const pts = parseInt(statsRes.rows[0]?.pts || '0', 10);
      const isCompleted = totalQ > 0 && answeredQ >= totalQ;

      // Extract book names
      const bookRes = await query(
        'SELECT book_name_ar, book_name_en FROM bible_verses WHERE book_number = $1 LIMIT 1',
        [row.book_number]
      );
      const bookNameAr = bookRes.rows[0]?.book_name_ar || 'الكتاب المقدس';
      const bookNameEn = bookRes.rows[0]?.book_name_en || 'Scripture';

      const refAr = row.start_chapter === row.end_chapter
        ? `${bookNameAr} ${row.start_chapter}: ${row.start_verse}-${row.end_verse}`
        : `${bookNameAr} ${row.start_chapter}: ${row.start_verse} - ${row.end_chapter}: ${row.end_verse}`;

      const refEn = row.start_chapter === row.end_chapter
        ? `${bookNameEn} ${row.start_chapter}:${row.start_verse}-${row.end_verse}`
        : `${bookNameEn} ${row.start_chapter}:${row.start_verse} - ${row.end_chapter}:${row.end_verse}`;

      history.push({
        reading_id: row.id,
        scheduled_date: typeof row.scheduled_date === 'string' 
          ? row.scheduled_date 
          : new Date(row.scheduled_date).toISOString().split('T')[0],
        book_number: row.book_number,
        book_name_ar: bookNameAr,
        book_name_en: bookNameEn,
        reference: { ar: refAr, en: refEn },
        total_questions: totalQ,
        answered_questions: answeredQ,
        correct_answers: correctQ,
        points_earned: pts,
        is_completed: isCompleted
      });
    }

    // 4. Calculate Scheduled-Day Streak & Status
    const todayReading = history.find(h => h.scheduled_date === today);
    const todayScheduled = !!todayReading;
    const todayCompleted = todayReading ? todayReading.is_completed : false;

    // Filter past scheduled readings before today
    const pastReadings = history.filter(h => h.scheduled_date < today);

    let streak = 0;
    let todayStatus: TodayStreakStatus = 'off_day';

    if (todayScheduled) {
      if (todayCompleted) {
        todayStatus = 'completed';
        streak = 1;
        // Check consecutive past completed readings
        for (const past of pastReadings) {
          if (past.is_completed) {
            streak += 1;
          } else {
            break;
          }
        }
      } else {
        // Today is scheduled but not completed yet
        // Check if previous scheduled reading was completed
        if (pastReadings.length > 0 && pastReadings[0].is_completed) {
          todayStatus = 'pending';
          // Count active streak from past completions
          for (const past of pastReadings) {
            if (past.is_completed) {
              streak += 1;
            } else {
              break;
            }
          }
        } else {
          // Missed previous reading, streak is broken
          todayStatus = pastReadings.length === 0 ? 'pending' : 'broken';
          streak = 0;
        }
      }
    } else {
      // Off day (no scheduled reading today)
      todayStatus = 'off_day';
      // Count consecutive completed readings from the last scheduled day
      for (const past of pastReadings) {
        if (past.is_completed) {
          streak += 1;
        } else {
          break;
        }
      }
    }

    const longestStreak = Math.max(user.longest_streak || 0, streak);
    const lastCompletedDate = user.last_completed_date 
      || (history.find(h => h.is_completed)?.scheduled_date || null);

    const { nextMilestone, daysToMilestone } = this.getNextMilestone(streak);

    return {
      user_id: userId,
      group_id: effectiveGroupId,
      current_streak: streak,
      longest_streak: longestStreak,
      last_completed_date: lastCompletedDate,
      today_date: today,
      today_scheduled: todayScheduled,
      today_completed: todayCompleted,
      today_status: todayStatus,
      next_milestone: nextMilestone,
      days_to_milestone: daysToMilestone,
      history
    };
  }

  /**
   * Updates streak and returns latest counts when a reading is marked completed
   */
  async updateStreakOnCompletion(
    client: any,
    userId: string,
    groupId: number,
    readingDate?: string
  ): Promise<{ current_streak: number; longest_streak: number }> {
    const today = readingDate || new Date().toISOString().split('T')[0];

    // Fetch scheduled readings for this group up to today in reverse order
    const scheduleRes = await client.query(`
      SELECT dr.id, dr.scheduled_date
      FROM daily_readings dr
      WHERE dr.group_id = $1 AND dr.scheduled_date <= $2
      ORDER BY dr.scheduled_date DESC
    `, [groupId, today]);

    let streak = 0;
    for (const row of scheduleRes.rows) {
      const checkRes = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM questions q WHERE q.reading_id = $1 AND q.is_approved = TRUE) AS total_q,
          (SELECT COUNT(*) FROM submissions s WHERE s.reading_id = $1 AND s.user_id = $2) AS answered_q
      `, [row.id, userId]);

      const totalQ = parseInt(checkRes.rows[0]?.total_q || '0', 10);
      const answeredQ = parseInt(checkRes.rows[0]?.answered_q || '0', 10);

      if (totalQ > 0 && answeredQ >= totalQ) {
        streak += 1;
      } else {
        break;
      }
    }

    // Update users table
    const updateRes = await client.query(`
      UPDATE users
      SET current_streak = $1,
          longest_streak = GREATEST(COALESCE(longest_streak, 0), $1),
          last_completed_date = $2
      WHERE id = $3
      RETURNING current_streak, longest_streak
    `, [streak, today, userId]);

    if (updateRes.rows && updateRes.rows.length > 0) {
      return {
        current_streak: updateRes.rows[0].current_streak,
        longest_streak: updateRes.rows[0].longest_streak
      };
    }

    return { current_streak: streak, longest_streak: streak };
  }
}

export const streakService = new StreakService();
