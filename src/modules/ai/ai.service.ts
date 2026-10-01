import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { config } from '../../config/env.js';
import { BibleVerseRow } from '../readings/readings.service.js';

export interface GeneratedQuestionPayload {
  type: 'mcq' | 'true_false';
  prompt_ar: string;
  prompt_en: string;
  options: Record<string, { ar: string; en: string }>;
  correct_answer: string;
}

export class AiQuestionService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    if (config.gemini.apiKey && config.gemini.apiKey !== 'mock-key-for-dev') {
      this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    }
  }

  async generateQuestionForPassage(
    verses: BibleVerseRow[],
    minGrade: number = 5,
    maxGrade: number = 6,
    type: 'mcq' | 'true_false' = 'mcq'
  ): Promise<GeneratedQuestionPayload> {
    if (!verses || verses.length === 0) {
      throw new Error('Cannot generate questions for empty verse list');
    }

    // Build verses text for prompt
    const versesAr = verses.map(v => `(${v.chapter}:${v.verse}) ${v.text_ar}`).join('\n');
    const versesEn = verses.map(v => `(${v.chapter}:${v.verse}) ${v.text_en}`).join('\n');

    // If no real API key is set, return a mock question derived from the actual verses
    if (!this.genAI) {
      return this.generateLocalFallbackQuestion(verses, type);
    }

    const systemInstruction = `You are an Orthodox Sunday school curriculum specialist. Generate an age-appropriate comprehension question for children in grades ${minGrade} to ${maxGrade}. Base the question STRICTLY on the provided scripture passage. Do NOT invent facts or cite external theological commentary outside the text. Output must be bilingual (Arabic: Van Dyck terminology, English: NKJV terminology) and formatted strictly according to JSON schema.`;

    const prompt = `<context>\n[ARABIC - SMITH & VAN DYCK]:\n${versesAr}\n\n[ENGLISH - NEW KING JAMES VERSION]:\n${versesEn}\n</context>\nGenerate 1 Multiple Choice Question (${type}) testing reading comprehension for grades ${minGrade}-${maxGrade}.`;

    try {
      const responseSchema: any = {
        type: SchemaType.OBJECT,
        properties: {
          type: {
            type: SchemaType.STRING
          },
          prompt_ar: {
            type: SchemaType.STRING,
            description: 'Question in Arabic with Van Dyck vocabulary'
          },
          prompt_en: {
            type: SchemaType.STRING,
            description: 'Question in English with NKJV vocabulary'
          },
          options: {
            type: SchemaType.OBJECT,
            properties: {
              A: {
                type: SchemaType.OBJECT,
                properties: {
                  ar: { type: SchemaType.STRING },
                  en: { type: SchemaType.STRING }
                },
                required: ['ar', 'en']
              },
              B: {
                type: SchemaType.OBJECT,
                properties: {
                  ar: { type: SchemaType.STRING },
                  en: { type: SchemaType.STRING }
                },
                required: ['ar', 'en']
              },
              C: {
                type: SchemaType.OBJECT,
                properties: {
                  ar: { type: SchemaType.STRING },
                  en: { type: SchemaType.STRING }
                },
                required: ['ar', 'en']
              },
              D: {
                type: SchemaType.OBJECT,
                properties: {
                  ar: { type: SchemaType.STRING },
                  en: { type: SchemaType.STRING }
                },
                required: ['ar', 'en']
              }
            },
            required: type === 'true_false' ? ['A', 'B'] : ['A', 'B', 'C', 'D']
          },
          correct_answer: {
            type: SchemaType.STRING,
            description: 'Letter of correct option (e.g. A, B, C, or D)'
          }
        },
        required: ['type', 'prompt_ar', 'prompt_en', 'options', 'correct_answer']
      };

      const model = this.genAI.getGenerativeModel({
        model: config.gemini.model || 'gemini-3.5-flash-lite',
        systemInstruction,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.2
        }
      });

      const response = await model.generateContent(prompt);
      let cleanText = response.response.text().trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      let parsed = JSON.parse(cleanText);
      if (Array.isArray(parsed) && parsed.length > 0) parsed = parsed[0];
      if (parsed.question && typeof parsed.question === 'object') parsed = parsed.question;

      this.validateGeneratedPayload(parsed);
      return parsed;
    } catch (err) {
      console.warn('Gemini API call failed or timed out, using fallback generator:', err);
      return this.generateLocalFallbackQuestion(verses, type);
    }
  }

  validateGeneratedPayload(payload: any): asserts payload is GeneratedQuestionPayload {
    if (!payload.type || !['mcq', 'true_false'].includes(payload.type)) {
      throw new Error('Invalid question type: must be mcq or true_false');
    }
    if (!payload.prompt_ar || !payload.prompt_en) {
      throw new Error('Missing bilingual prompts');
    }
    if (!payload.options || typeof payload.options !== 'object') {
      throw new Error('Options must be a key-value object');
    }
    if (!payload.correct_answer || !payload.options[payload.correct_answer]) {
      throw new Error(`correct_answer '${payload.correct_answer}' not present in options`);
    }

    for (const [key, val] of Object.entries(payload.options)) {
      const opt = val as any;
      if (!opt.ar || !opt.en) {
        throw new Error(`Option ${key} must contain both 'ar' and 'en' translations`);
      }
    }
  }

  private generateLocalFallbackQuestion(verses: BibleVerseRow[], type: 'mcq' | 'true_false'): GeneratedQuestionPayload {
    const v1 = verses[0];
    if (type === 'true_false') {
      return {
        type: 'true_false',
        prompt_ar: `هَلْ ذُكِرَ فِي هَذَا النَّصِّ: "${v1.text_ar.slice(0, 40)}..."؟`,
        prompt_en: `Is it mentioned in this passage: "${v1.text_en.slice(0, 40)}..."?`,
        options: {
          A: { ar: 'صَحِيحٌ', en: 'True' },
          B: { ar: 'خَطَأٌ', en: 'False' }
        },
        correct_answer: 'A'
      };
    }

    return {
      type: 'mcq',
      prompt_ar: `بِحَسَبِ الآيَةِ (${v1.chapter}:${v1.verse})، مَاذَا يُعَلِّمُنَا النَّصُّ؟`,
      prompt_en: `According to verse (${v1.chapter}:${v1.verse}), what does the text show?`,
      options: {
        A: { ar: v1.text_ar.slice(0, 80), en: v1.text_en.slice(0, 80) },
        B: { ar: 'اخْتِيَارٌ غَيْرُ صَحِيحٍ ١', en: 'Incorrect option 1' },
        C: { ar: 'اخْتِيَارٌ غَيْرُ صَحِيحٍ ٢', en: 'Incorrect option 2' },
        D: { ar: 'اخْتِيَارٌ غَيْرُ صَحِيحٍ ٣', en: 'Incorrect option 3' }
      },
      correct_answer: 'A'
    };
  }
}

export const aiQuestionService = new AiQuestionService();
