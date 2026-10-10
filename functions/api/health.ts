const GEMINI_MODEL = 'gemini-2.5-flash';

export const onRequestGet = (): Response => new Response(
  JSON.stringify({ status: 'ok', model: GEMINI_MODEL }),
  {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  },
);
