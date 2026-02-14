-- RLS Policies for all tables
-- This migration creates policies to allow proper access to data

-- Helper function to check if user is admin or super_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get user's operator_id
CREATE OR REPLACE FUNCTION public.get_user_operator_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT operator_id FROM public.user_roles
    WHERE user_id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SHARED REFERENCE DATA TABLES (no operator_id)
-- All authenticated users can SELECT
-- Only admin/super_admin can INSERT/UPDATE/DELETE
-- ============================================================================

-- COUNTRIES TABLE
DROP POLICY IF EXISTS "Allow authenticated users to read countries" ON countries;
DROP POLICY IF EXISTS "Allow admins to insert countries" ON countries;
DROP POLICY IF EXISTS "Allow admins to update countries" ON countries;
DROP POLICY IF EXISTS "Allow admins to delete countries" ON countries;

CREATE POLICY "Allow authenticated users to read countries"
  ON countries FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to insert countries"
  ON countries FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to update countries"
  ON countries FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to delete countries"
  ON countries FOR DELETE
  TO authenticated
  USING (is_admin());

-- AIRPORTS TABLE
DROP POLICY IF EXISTS "Allow authenticated users to read airports" ON airports;
DROP POLICY IF EXISTS "Allow admins to insert airports" ON airports;
DROP POLICY IF EXISTS "Allow admins to update airports" ON airports;
DROP POLICY IF EXISTS "Allow admins to delete airports" ON airports;

CREATE POLICY "Allow authenticated users to read airports"
  ON airports FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to insert airports"
  ON airports FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to update airports"
  ON airports FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to delete airports"
  ON airports FOR DELETE
  TO authenticated
  USING (is_admin());

-- AIRLINES TABLE
DROP POLICY IF EXISTS "Allow authenticated users to read airlines" ON airlines;
DROP POLICY IF EXISTS "Allow admins to insert airlines" ON airlines;
DROP POLICY IF EXISTS "Allow admins to update airlines" ON airlines;
DROP POLICY IF EXISTS "Allow admins to delete airlines" ON airlines;

CREATE POLICY "Allow authenticated users to read airlines"
  ON airlines FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to insert airlines"
  ON airlines FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to update airlines"
  ON airlines FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to delete airlines"
  ON airlines FOR DELETE
  TO authenticated
  USING (is_admin());

-- CITY_PAIRS TABLE
DROP POLICY IF EXISTS "Allow authenticated users to read city_pairs" ON city_pairs;
DROP POLICY IF EXISTS "Allow admins to insert city_pairs" ON city_pairs;
DROP POLICY IF EXISTS "Allow admins to update city_pairs" ON city_pairs;
DROP POLICY IF EXISTS "Allow admins to delete city_pairs" ON city_pairs;

CREATE POLICY "Allow authenticated users to read city_pairs"
  ON city_pairs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to insert city_pairs"
  ON city_pairs FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to update city_pairs"
  ON city_pairs FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Allow admins to delete city_pairs"
  ON city_pairs FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================================
-- OPERATOR-SCOPED TABLES (have operator_id)
-- Users can only access rows matching their operator_id
-- ============================================================================

-- AIRCRAFT_TYPES TABLE
DROP POLICY IF EXISTS "Users can read their operator's aircraft types" ON aircraft_types;
DROP POLICY IF EXISTS "Users can insert their operator's aircraft types" ON aircraft_types;
DROP POLICY IF EXISTS "Users can update their operator's aircraft types" ON aircraft_types;
DROP POLICY IF EXISTS "Users can delete their operator's aircraft types" ON aircraft_types;

CREATE POLICY "Users can read their operator's aircraft types"
  ON aircraft_types FOR SELECT
  TO authenticated
  USING (operator_id = get_user_operator_id());

CREATE POLICY "Users can insert their operator's aircraft types"
  ON aircraft_types FOR INSERT
  TO authenticated
  WITH CHECK (operator_id = get_user_operator_id() AND is_admin());

CREATE POLICY "Users can update their operator's aircraft types"
  ON aircraft_types FOR UPDATE
  TO authenticated
  USING (operator_id = get_user_operator_id() AND is_admin())
  WITH CHECK (operator_id = get_user_operator_id() AND is_admin());

CREATE POLICY "Users can delete their operator's aircraft types"
  ON aircraft_types FOR DELETE
  TO authenticated
  USING (operator_id = get_user_operator_id() AND is_admin());

-- OPERATORS TABLE
-- All authenticated users can read their operator
-- Only admins can update
DROP POLICY IF EXISTS "Users can read their operator" ON operators;
DROP POLICY IF EXISTS "Admins can update operators" ON operators;

CREATE POLICY "Users can read their operator"
  ON operators FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update operators"
  ON operators FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================================
-- USER TABLES
-- Users can only access their own records
-- ============================================================================

-- USER_ROLES TABLE
DROP POLICY IF EXISTS "Users can read their own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can read all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;

CREATE POLICY "Users can read their own role"
  ON user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert roles"
  ON user_roles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update roles"
  ON user_roles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete roles"
  ON user_roles FOR DELETE
  TO authenticated
  USING (is_admin());

-- USER_PREFERENCES TABLE
DROP POLICY IF EXISTS "Users can read their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
DROP POLICY IF EXISTS "Users can delete their own preferences" ON user_preferences;

CREATE POLICY "Users can read their own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own preferences"
  ON user_preferences FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================================================
-- MODULE_DEFINITIONS TABLE (if it exists)
-- All authenticated users can read
-- Only admins can modify
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'module_definitions') THEN
    DROP POLICY IF EXISTS "Users can read module definitions" ON module_definitions;
    DROP POLICY IF EXISTS "Admins can insert module definitions" ON module_definitions;
    DROP POLICY IF EXISTS "Admins can update module definitions" ON module_definitions;
    DROP POLICY IF EXISTS "Admins can delete module definitions" ON module_definitions;

    CREATE POLICY "Users can read module definitions"
      ON module_definitions FOR SELECT
      TO authenticated
      USING (true);

    CREATE POLICY "Admins can insert module definitions"
      ON module_definitions FOR INSERT
      TO authenticated
      WITH CHECK (is_admin());

    CREATE POLICY "Admins can update module definitions"
      ON module_definitions FOR UPDATE
      TO authenticated
      USING (is_admin())
      WITH CHECK (is_admin());

    CREATE POLICY "Admins can delete module definitions"
      ON module_definitions FOR DELETE
      TO authenticated
      USING (is_admin());
  END IF;
END $$;

-- Grant execute permissions on helper functions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_operator_id() TO authenticated;
