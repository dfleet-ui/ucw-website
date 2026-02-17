// Netlify Function: Gemini proxy (keeps your API key off the browser)
// Docs: https://ai.google.dev/api/generate-content

function json(statusCode, bodyObj, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
    body: JSON.stringify(bodyObj),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    // Same-origin calls usually don't need this, but it helps local testing.
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed. Use POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return json(500, {
      error:
        'Missing GEMINI_API_KEY (or GOOGLE_API_KEY) environment variable in your Netlify site settings.',
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON body.' });
  }

  // Choose a sensible default model for web chat + simple tools
  const model = payload.model || 'gemini-2.5-flash-lite';

  // Support the older Anthropic-style inputs used by the front-end
  const system = (payload.system || '').toString();
  const maxOutputTokens = Number(
    payload.max_output_tokens ?? payload.maxOutputTokens ?? payload.max_tokens ?? 1000
  );
  const temperature =
    payload.temperature === 0 ? 0 : Number(payload.temperature ?? 0.4);

  const messages = Array.isArray(payload.messages) ? payload.messages : null;
  const contents = Array.isArray(payload.contents) ? payload.contents : null;

  // Build Gemini "contents" (chat history)
  const geminiContents = contents
    ? contents
    : (messages || []).map((m) => {
        const roleRaw = (m?.role || 'user').toString();
        const role = roleRaw === 'assistant' ? 'model' : roleRaw;
        const text = (m?.content ?? '').toString();
        return { role, parts: [{ text }] };
      });

  const reqBody = {
    contents: geminiContents,
    generationConfig: {
      maxOutputTokens: Number.isFinite(maxOutputTokens)
        ? Math.max(1, Math.min(8192, maxOutputTokens))
        : 1000,
      temperature: Number.isFinite(temperature)
        ? Math.max(0, Math.min(2, temperature))
        : 0.4,
    },
  };

  if (system.trim()) {
    // The REST field is "systemInstruction" (camelCase)
    reqBody.systemInstruction = {
      role: 'system',
      parts: [{ text: system }],
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqBody),
    });

    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!resp.ok) {
      return json(resp.status, {
        error: 'Gemini API error',
        details: data,
      });
    }

    // Return full response so the front-end can read candidates[].content.parts[].text
    return json(200, data, {
      // If you ever call this cross-origin, uncomment the next line.
      // 'Access-Control-Allow-Origin': '*',
    });
  } catch (err) {
    return json(500, {
      error: 'Server error calling Gemini API',
      message: err?.message || String(err),
    });
  }
};
