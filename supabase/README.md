# Supabase backend

## Edge Function: `analyze-document`

Proxies the Gemini vision API so the API key stays server-side.

- **Deploy:** `supabase functions deploy analyze-document`
- **Secrets:** Set `GEMINI_API_KEY` in the [Supabase Dashboard](https://supabase.com/dashboard) under Project Settings → Edge Functions → Secrets, or:
  ```bash
  supabase secrets set GEMINI_API_KEY=your_gemini_api_key
  ```
- **Local:** Put `GEMINI_API_KEY=...` in `supabase/functions/.env` (do not commit), then `supabase functions serve analyze-document`.

Frontend uses this when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set; otherwise it falls back to direct Gemini (if `VITE_GEMINI_API_KEY` is set) or mock.
