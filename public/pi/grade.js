export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { essayText, gradeLevel } = req.body || {};

  if (!essayText || essayText.trim().length < 20) {
    return res.status(400).json({ error: 'Please paste a longer essay to grade.' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'Server is missing GEMINI_API_KEY. Add it in Vercel project settings.' });
  }

  const prompt = `You are an expert writing teacher grading a student essay for a student in grade level "${gradeLevel || 'unspecified'}".

Here is the essay:
"""
${essayText}
"""

Respond ONLY with valid JSON, no markdown fences, no preamble, no explanation. Use exactly this shape:

{
  "criteria": [
    { "name": "Argument", "score": 1, "maxScore": 4, "comment": "short explanation of this score" },
    { "name": "Clarity", "score": 1, "maxScore": 4, "comment": "short explanation of this score" },
    { "name": "Structure", "score": 1, "maxScore": 4, "comment": "short explanation of this score" },
    { "name": "Evidence & Examples", "score": 1, "maxScore": 4, "comment": "short explanation of this score" }
  ],
  "inlineFeedback": [
    { "quote": "a short exact phrase copied from the essay (under 12 words)", "comment": "specific feedback about this exact phrase, with a concrete suggestion" }
  ],
  "summaryForStudent": "a short, encouraging 2-4 sentence summary written directly to the student, in simple language, highlighting one clear strength and one clear area to improve next time"
}

Score each criterion from 1 (needs significant work) to 4 (excellent). Provide 3 to 5 inlineFeedback items, each anchored to a real, short, exact quote copied verbatim from the essay text above. Be constructive and specific, never harsh. The "summaryForStudent" must be encouraging and age-appropriate for grade level "${gradeLevel || 'the student'}".`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'AI request failed.' });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: 'Could not parse the AI response. Please try again.' });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unexpected server error.' });
  }
}
