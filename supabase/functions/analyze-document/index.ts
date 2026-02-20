// Supabase Edge Function: proxy for Gemini vision API.
// Keeps GEMINI_API_KEY server-side. Accepts { imageBase64, prompt }, returns Gemini JSON.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

function parseJSON(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in response");
  return JSON.parse(match[0]);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("[analyze-document] GEMINI_API_KEY not set");
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  let body: { imageBase64?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const { imageBase64, prompt } = body;
  if (!imageBase64 || !prompt) {
    return jsonResponse(
      { error: "Missing imageBase64 or prompt" },
      400
    );
  }

  const base64Data = imageBase64.includes(",")
    ? imageBase64.split(",")[1]
    : imageBase64;

  const geminiBody = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: "image/jpeg", data: base64Data } },
          { text: prompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  };

  const url = `${GEMINI_BASE}/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(geminiBody),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[analyze-document] Gemini error:", res.status, err);
    return jsonResponse(
      { error: `Gemini API error ${res.status}` },
      res.status === 401 ? 502 : 502
    );
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return jsonResponse({ error: "Empty response from Gemini" }, 502);
  }

  try {
    const parsed = parseJSON(text);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders(), "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[analyze-document] Parse error:", e);
    return jsonResponse({ error: "Invalid response from Gemini" }, 502);
  }
});

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(obj: object, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), "Content-Type": "application/json" },
  });
}
