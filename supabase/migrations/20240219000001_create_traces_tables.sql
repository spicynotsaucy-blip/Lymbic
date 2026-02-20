-- Tables for Lymbic: logic_traces, analysis_errors, corrections.
-- Phase 2: anon can insert and select. Phase 3 will add user_id and restrict by auth.uid().

CREATE TABLE IF NOT EXISTS public.logic_traces (
  id text PRIMARY KEY,
  session_id text NOT NULL,
  score smallint NOT NULL,
  is_correct boolean NOT NULL,
  logic_trace jsonb NOT NULL,
  divergence_point jsonb,
  remediation text NOT NULL,
  confidence real NOT NULL DEFAULT 0.8,
  capture_quality real NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.analysis_errors (
  id bigserial PRIMARY KEY,
  raw_response text,
  error text,
  capture_metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.corrections (
  id bigserial PRIMARY KEY,
  trace_id text NOT NULL,
  original_error_type text,
  actual_error_type text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.logic_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;

-- Phase 2: allow anon read/write so app works without auth. Phase 3 will add user_id and stricter policies.
CREATE POLICY "anon_select_logic_traces" ON public.logic_traces FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_logic_traces" ON public.logic_traces FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_analysis_errors" ON public.analysis_errors FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_analysis_errors" ON public.analysis_errors FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "anon_select_corrections" ON public.corrections FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_corrections" ON public.corrections FOR INSERT TO anon WITH CHECK (true);
