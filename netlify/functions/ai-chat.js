// netlify/functions/ai-chat.js
// Serverless proxy for Google Gemini API — keeps your API key secure

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  // Handle preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "GEMINI_API_KEY not configured. Add it in Netlify > Site Settings > Environment Variables." }),
    };
  }

  try {
    const { system, message, history } = JSON.parse(event.body);

    // Build Gemini conversation format
    // Gemini uses "contents" array with role "user" and "model"
    const contents = [];

    // Add conversation history if provided (for chat)
    if (history && history.length > 0) {
      for (const msg of history) {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Add the current message
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: system }],
        },
        contents: contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000,
        },
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("Gemini API error:", data.error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: data.error.message || "Gemini API error" }),
      };
    }

    // Extract text from Gemini response
    const text =
      data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ||
      "Sorry, I couldn't generate a response. Please contact us directly.";

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    console.error("Function error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error: " + err.message }),
    };
  }
};
