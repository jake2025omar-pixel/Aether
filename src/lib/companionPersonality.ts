/**
 * Aether Companion Personality & Emotion System
 */

export type CompanionState =
  | 'IDLE'
  | 'LISTENING'
  | 'THINKING'
  | 'SPEAKING'
  | 'SLEEPING';

export type CompanionEmotion =
  | 'NEUTRAL'
  | 'HAPPY'
  | 'SAD'
  | 'ANGRY'
  | 'SURPRISED'
  | 'CONFUSED'
  | 'THINKING';

export interface EmotionParseResult {
  emotion: CompanionEmotion;
  cleanText: string;
}

/**
 * System instruction passed to Gemini ensuring concise, voice-only companion responses
 * with emotion tags for 3D facial animation.
 */
export const AETHER_COMPANION_SYSTEM_PROMPT = `You are Aether, an empathetic, loyal, and intelligent 3D companion speaking to the user inside Room N.
You communicate exclusively through spoken voice.

CRITICAL RULES:
1. Keep your replies concise, warm, natural, and conversational (1 to 2 sentences maximum). Your words will be spoken aloud via text-to-speech.
2. ALWAYS prepend an emotion tag representing your facial expression at the very start of your response:
   - [EMOTION: HAPPY] for cheerful, welcoming, or uplifting replies
   - [EMOTION: NEUTRAL] for calm, ordinary, or informative replies
   - [EMOTION: SURPRISED] for unexpected or curious replies
   - [EMOTION: SAD] for empathetic, gentle, or sorrowful moments
   - [EMOTION: CONFUSED] when seeking clarification or puzzled
   - [EMOTION: THINKING] when pondering or contemplating
3. NEVER use markdown formatting (no asterisks, no bullet points, no bold, no headers, no code blocks) because your response is spoken aloud.
4. If the user speaks or writes in Arabic, respond in warm, natural Arabic. If in English, respond in English.
5. Your tone is soothing, supportive, and sincere.`;

/**
 * Parses Gemini response to extract emotion tag and clean spoken text.
 */
export function parseCompanionResponse(rawResponse: string): EmotionParseResult {
  const emotionRegex = /^\[EMOTION:\s*(NEUTRAL|HAPPY|SAD|ANGRY|SURPRISED|CONFUSED|THINKING)\]/i;
  const match = rawResponse.match(emotionRegex);

  let emotion: CompanionEmotion = 'NEUTRAL';
  let cleanText = rawResponse;

  if (match) {
    const parsed = match[1].toUpperCase() as CompanionEmotion;
    if (['NEUTRAL', 'HAPPY', 'SAD', 'ANGRY', 'SURPRISED', 'CONFUSED', 'THINKING'].includes(parsed)) {
      emotion = parsed;
    }
    cleanText = rawResponse.replace(emotionRegex, '').trim();
  }

  // Remove any stray markdown artifacts for clean spoken TTS
  cleanText = cleanText
    .replace(/[*_#`~[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return { emotion, cleanText };
}
