// Supabase Edge Function: submit teacher correction.
// Validates payload and inserts into corrections table with user_id from JWT.

import { createClient } from "npm:@supabase/supabase-js@2";

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing or invalid Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: {
    trace_id?: string;
    original_error_type?: string;
    actual_error_type?: string;
    notes?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { trace_id, original_error_type, actual_error_type, notes } = body;
  if (!trace_id) {
    return jsonResponse({ error: "Missing trace_id" }, 400);
  }

  const record = {
    trace_id,
    original_error_type: original_error_type || null,
    actual_error_type: actual_error_type || null,
    notes: notes || null,
    user_id: user.id,
  };

  const { error } = await supabase.from("corrections").insert(record);
  if (error) {
    console.error("[submit-correction] Insert failed:", error);
    return jsonResponse({ error: "Failed to save correction" }, 500);
  }

  return jsonResponse({ success: true }, 200);
});
