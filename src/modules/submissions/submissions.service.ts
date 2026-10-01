import { query, getClient } from '../../db/pool.js';
import { leaderboardService } from '../../redis/leaderboard.service.js';
import { streakService } from '../streak/streak.service.js';

export interface SubmitAnswerResult {
  question_id: string;
  is_correct: boolean;
  points_earned: number;
  current_total_points: number;
  current_streak: number;
  longest_streak: number;
  reading_completed: boolean;
}

export class SubmissionsService {
  async submitAnswer(
    userId: string,
    readingId: string,
    questionId: string,
    answerText: string
  ): Promise<SubmitAnswerResult> {
    const client = await getClient();

    try {
      await client.query('BEGIN');

      // 1. Check if user already submitted for this question
      const existing = await client.query(
        'SELECT id, is_correct, points_awarded FROM submissions WHERE user_id = $1 AND question_id = $2',
        [userId, questionId]
      );
      if (existing.rows.length > 0) {
        throw new Error('ALREADY_SUBMITTED: Question has already been answered.');
      }

      // 2. Fetch question details
      const qRes = await client.query(
        'SELECT id, reading_id, type, correct_answer, points_value FROM questions WHERE id = $1',
        [questionId]
      );
      if (qRes.rows.length === 0) {
        throw new Error('QUESTION_NOT_FOUND: Specified question does not exist.');
      }
      const question = qRes.rows[0];

      // 3. Fetch user details
      const uRes = await client.query(
        'SELECT id, group_id, total_points, current_streak, longest_streak FROM users WHERE id = $1',
        [userId]
      );
      if (uRes.rows.length === 0) {
        throw new Error('USER_NOT_FOUND: User not found.');
      }
      const user = uRes.rows[0];

      // 4. Verify answer correctness
      const cleanAnswer = answerText.trim().toUpperCase();
      const cleanExpected = question.correct_answer.trim().toUpperCase();
      const isCorrect = cleanAnswer === cleanExpected;
      const pointsAwarded = isCorrect ? (question.points_value || 10) : 0;

      // 5. Insert submission
      await client.query(`
        INSERT INTO submissions (user_id, reading_id, question_id, answer_text, is_correct, points_awarded)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [userId, readingId, questionId, answerText, isCorrect, pointsAwarded]);

      // 6. Update user points if correct
      let updatedTotalPoints = user.total_points;
      if (isCorrect && pointsAwarded > 0) {
        updatedTotalPoints += pointsAwarded;
        await client.query(
          'UPDATE users SET total_points = total_points + $1 WHERE id = $2',
          [pointsAwarded, userId]
        );
      }

      // 7. Check if reading is now fully completed
      const totalQuestionsRes = await client.query(
        'SELECT COUNT(*) AS total FROM questions WHERE reading_id = $1 AND is_approved = TRUE',
        [readingId]
      );
      const answeredQuestionsRes = await client.query(
        'SELECT COUNT(*) AS answered FROM submissions WHERE reading_id = $1 AND user_id = $2',
        [readingId, userId]
      );

      const totalQuestions = parseInt(totalQuestionsRes.rows[0].total, 10);
      const answeredQuestions = parseInt(answeredQuestionsRes.rows[0].answered, 10);
      const readingCompleted = totalQuestions > 0 && answeredQuestions >= totalQuestions;

      // 8. Update Streak on reading completion
      let updatedStreak = user.current_streak;
      let longestStreak = user.longest_streak || user.current_streak;
      if (readingCompleted) {
        const streakRes = await streakService.updateStreakOnCompletion(client, userId, user.group_id);
        updatedStreak = streakRes.current_streak;
        longestStreak = streakRes.longest_streak;
      }

      await client.query('COMMIT');

      // 9. Update Redis multi-window leaderboards asynchronously / out of tx
      if (isCorrect && pointsAwarded > 0 && user.group_id) {
        leaderboardService.recordScore(user.group_id, userId, pointsAwarded).catch(err => {
          console.error('Failed to update Redis leaderboard', err);
        });
      }

      return {
        question_id: questionId,
        is_correct: isCorrect,
        points_earned: pointsAwarded,
        current_total_points: updatedTotalPoints,
        current_streak: updatedStreak,
        longest_streak: longestStreak,
        reading_completed: readingCompleted
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const submissionsService = new SubmissionsService();

