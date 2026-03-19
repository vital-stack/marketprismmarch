CREATE TABLE user_calendar_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  calendar_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_calendar_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own state" ON user_calendar_state
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own state" ON user_calendar_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own state" ON user_calendar_state
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own state" ON user_calendar_state
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION update_user_calendar_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_calendar_state_set_updated_at
  BEFORE UPDATE ON user_calendar_state
  FOR EACH ROW EXECUTE FUNCTION update_user_calendar_state_updated_at();
