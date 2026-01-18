-- Fix RLS policies for dialogue and agreements to allow anonymous access
-- (Aligning with the rest of the app's existing permissive schema)

DROP POLICY IF EXISTS "Users can view their partnership dialogues" ON public.dialogues;
DROP POLICY IF EXISTS "Users can insert dialogues in their partnership" ON public.dialogues;
DROP POLICY IF EXISTS "Users can view their partnership agreements" ON public.agreements;
DROP POLICY IF EXISTS "Users can insert agreements in their partnership" ON public.agreements;
DROP POLICY IF EXISTS "Users can update agreements in their partnership" ON public.agreements;

CREATE POLICY "Allow all operations on dialogues" ON public.dialogues
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on agreements" ON public.agreements
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
