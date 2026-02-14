-- Create operators table
CREATE TABLE IF NOT EXISTS operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'viewer')),
  enabled_modules TEXT[] NOT NULL DEFAULT ARRAY['home']::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_operators_user_id ON operators(user_id);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_operators_email ON operators(email);

-- Enable Row Level Security
ALTER TABLE operators ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own operator record
CREATE POLICY "Users can read own operator record"
  ON operators
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can read all operator records
CREATE POLICY "Admins can read all operator records"
  ON operators
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM operators
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Admins can update all operator records
CREATE POLICY "Admins can update all operator records"
  ON operators
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM operators
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Admins can insert operator records
CREATE POLICY "Admins can insert operator records"
  ON operators
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM operators
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Policy: Admins can delete operator records
CREATE POLICY "Admins can delete operator records"
  ON operators
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM operators
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_operators_updated_at
  BEFORE UPDATE ON operators
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create operator record when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.operators (user_id, email, enabled_modules)
  VALUES (NEW.id, NEW.email, ARRAY['network', 'operations', 'workforce', 'reports']::TEXT[]);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create operator record on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Insert a seed admin user (you'll need to update this with your actual user_id after registration)
-- Uncomment and update the user_id after creating your first user
-- INSERT INTO operators (user_id, email, full_name, role, enabled_modules)
-- VALUES (
--   'YOUR_USER_ID_HERE',
--   'admin@example.com',
--   'System Administrator',
--   'admin',
--   ARRAY['home', 'network', 'operations', 'workforce', 'reports', 'admin']::TEXT[]
-- )
-- ON CONFLICT (user_id) DO UPDATE
-- SET role = 'admin',
--     enabled_modules = ARRAY['home', 'network', 'operations', 'workforce', 'reports', 'admin']::TEXT[];
