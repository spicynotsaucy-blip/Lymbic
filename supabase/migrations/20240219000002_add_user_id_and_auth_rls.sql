-- Phase 3: Add user_id and restrict access to authenticated users only.

ALTER TABLE public.logic_traces
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.analysis_errors
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.corrections
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Drop anon policies
DROP POLICY IF EXISTS "anon_select_logic_traces" ON public.logic_traces;
DROP POLICY IF EXISTS "anon_insert_logic_traces" ON public.logic_traces;
DROP POLICY IF EXISTS "anon_select_analysis_errors" ON public.analysis_errors;
DROP POLICY IF EXISTS "anon_insert_analysis_errors" ON public.analysis_errors;
DROP POLICY IF EXISTS "anon_select_corrections" ON public.corrections;
DROP POLICY IF EXISTS "anon_insert_corrections" ON public.corrections;

-- Authenticated: select only own rows
CREATE POLICY "auth_select_own_logic_traces" ON public.logic_traces
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "auth_select_own_analysis_errors" ON public.analysis_errors
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "auth_select_own_corrections" ON public.corrections
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Authenticated: insert with own user_id
CREATE POLICY "auth_insert_own_logic_traces" ON public.logic_traces
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "auth_insert_own_analysis_errors" ON public.analysis_errors
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "auth_insert_own_corrections" ON public.corrections
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Allow anon to read nothing; anon can still create an account and then use authenticated policies.
-- Service role can backfill user_id for existing rows if needed.
