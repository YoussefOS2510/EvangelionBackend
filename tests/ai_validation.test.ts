import { describe, it, expect } from 'vitest';
import { AiQuestionService, GeneratedQuestionPayload } from '../src/modules/ai/ai.service.js';

describe('AI Question Generation Schema & Guardrails', () => {
  const service = new AiQuestionService();

  it('validates correct MCQ question payload', () => {
    const validMCQ: GeneratedQuestionPayload = {
      type: 'mcq',
      prompt_ar: 'مَا اسْمُ الرَّجُلِ الَّذِي جَاءَ إِلَى يَسُوعَ لَيْلاً؟',
      prompt_en: 'What was the name of the man who came to Jesus by night?',
      options: {
        A: { ar: 'نِيقُودِيمُوسُ', en: 'Nicodemus' },
        B: { ar: 'بُولُسُ', en: 'Paul' },
        C: { ar: 'بُطْرُسُ', en: 'Peter' },
        D: { ar: 'لِعَازَرُ', en: 'Lazarus' }
      },
      correct_answer: 'A'
    };

    expect(() => service.validateGeneratedPayload(validMCQ)).not.toThrow();
  });

  it('validates correct True/False question payload', () => {
    const validTF: GeneratedQuestionPayload = {
      type: 'true_false',
      prompt_ar: 'كَانَ نِيقُودِيمُوسُ رَئِيساً لِلْيَهُودِ.',
      prompt_en: 'Nicodemus was a ruler of the Jews.',
      options: {
        A: { ar: 'صَحِيحٌ', en: 'True' },
        B: { ar: 'خَطَأٌ', en: 'False' }
      },
      correct_answer: 'A'
    };

    expect(() => service.validateGeneratedPayload(validTF)).not.toThrow();
  });

  it('rejects payload when correct_answer is not in options', () => {
    const invalidAnswer: any = {
      type: 'mcq',
      prompt_ar: 'سؤال',
      prompt_en: 'question',
      options: {
        A: { ar: 'خيار 1', en: 'opt 1' },
        B: { ar: 'خيار 2', en: 'opt 2' }
      },
      correct_answer: 'Z' // Non-existent key
    };

    expect(() => service.validateGeneratedPayload(invalidAnswer)).toThrow(
      "correct_answer 'Z' not present in options"
    );
  });

  it('rejects payload when bilingual translations are missing in options', () => {
    const missingEn: any = {
      type: 'mcq',
      prompt_ar: 'سؤال',
      prompt_en: 'question',
      options: {
        A: { ar: 'خيار 1' } // missing 'en'
      },
      correct_answer: 'A'
    };

    expect(() => service.validateGeneratedPayload(missingEn)).toThrow(
      "Option A must contain both 'ar' and 'en' translations"
    );
  });

  it('generates a valid fallback question when offline', async () => {
    const verses = [
      {
        book_number: 43,
        chapter: 3,
        verse: 1,
        text_ar: 'كَانَ إِنْسَانٌ مِنَ الْفَرِّيسِيِّينَ اسْمُهُ نِيقُودِيمُوسُ',
        text_ar_clean: 'كان انسان من الفريسيين اسمه نيقوديموس',
        text_en: 'There was a man of the Pharisees named Nicodemus'
      }
    ];

    // Explicitly verify the fallback generator logic
    const fallback = (service as any).generateLocalFallbackQuestion(verses, 'mcq');
    expect(fallback.type).toBe('mcq');
    expect(fallback.options.A).toBeDefined();
    expect(fallback.options.A.en).toContain('Nicodemus');
    expect(() => service.validateGeneratedPayload(fallback)).not.toThrow();

    // Verify generateQuestionForPassage produces a compliant payload
    const generated = await service.generateQuestionForPassage(verses, 5, 6, 'mcq');
    expect(generated.type).toBe('mcq');
    expect(generated.options.A).toBeDefined();
    expect(generated.options.B).toBeDefined();
    expect(() => service.validateGeneratedPayload(generated)).not.toThrow();
  });
});
