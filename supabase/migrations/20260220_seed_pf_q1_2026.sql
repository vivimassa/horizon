-- ═══════════════════════════════════════════════════════════
-- SEED PERFORMANCE FACTOR PERIOD: Q1 2026
-- Source: Vietjet FOE "PERFORMANCE FACTOR" PDF
-- Original period: 01 OCT 2025 - 31 DEC 2025
-- Seeded as: 01 JAN 2026 - 31 MAR 2026 (per user request)
-- ═══════════════════════════════════════════════════════════

-- First, get the operator_id
DO $$
DECLARE
  v_operator_id UUID;
  v_aircraft_id UUID;
BEGIN
  SELECT id INTO v_operator_id FROM operators LIMIT 1;

  -- Insert all 79 aircraft from FOE document
  -- A321 NEO (321-271NX)
  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A500' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 0.4, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A516' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 0.1, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A523' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 1.0, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A525' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 1.5, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A526' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 1.8, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A528' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 1.0, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A534' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 2.6, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A536' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 1.5, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A537' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 0.8, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A538' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 0.9, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A539' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 0.6, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A543' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 0.2, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A545' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 0.1, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A546' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 0.6, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A547' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 0.5, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A548' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 0.5, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A549' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 0.2, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A550' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 0.3, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A552' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', -0.8, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A553' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', -0.9, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A554' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', -1.5, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A578' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', -0.5, '321-271NX');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A580' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', -0.2, '321-271NX');
  END IF;

  -- A321 NEO (321-271N) — older neo engine option
  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A607' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 1.7, '321-271N');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A646' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 3.0, '321-271N');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A653' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 1.9, '321-271N');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A674' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 2.8, '321-271N');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A693' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 1.9, '321-271N');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A697' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 1.7, '321-271N');
  END IF;

  -- A321 CEO (321-211)
  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A522' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 6.0, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A532' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 6.8, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A535' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 5.1, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A542' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.9, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A544' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 5.7, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A629' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 6.3, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A630' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 5.2, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A632' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.3, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A633' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 5.5, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A634' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 7.5, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A635' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 7.2, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A636' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 3.3, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A637' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 7.9, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A639' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 8.4, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A640' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 6.1, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A641' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 6.9, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A642' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.9, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A643' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 7.2, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A644' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 6.7, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A645' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 5.5, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A647' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 6.3, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A648' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 6.6, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A649' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.7, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A651' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 6.5, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A657' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 5.6, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A661' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.8, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A667' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 5.7, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A670' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 5.5, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A673' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 5.3, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A677' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.9, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A683' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 7.7, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A684' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 5.5, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A685' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 7.3, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A687' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 6.0, '321-211');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A698' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 7.4, '321-211');
  END IF;

  -- A320 CEO (320-214)
  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A650' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.4, '320-214');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A655' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.4, '320-214');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A656' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.8, '320-214');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A658' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.9, '320-214');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A662' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 5.3, '320-214');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A663' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 5.0, '320-214');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A666' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.6, '320-214');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A668' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.7, '320-214');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A669' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.4, '320-214');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A671' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 6.5, '320-214');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A672' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.9, '320-214');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A675' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 5.0, '320-214');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A676' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 5.2, '320-214');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A689' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 3.7, '320-214');
  END IF;

  SELECT id INTO v_aircraft_id FROM aircraft WHERE registration = 'VN-A699' AND operator_id = v_operator_id;
  IF v_aircraft_id IS NOT NULL THEN
    INSERT INTO aircraft_performance_factors (operator_id, aircraft_id, period_name, effective_from, effective_to, performance_factor, variant)
    VALUES (v_operator_id, v_aircraft_id, 'Q1 2026', '2026-01-01', '2026-03-31', 4.3, '320-214');
  END IF;

  -- Also sync aircraft.performance_factor and aircraft.variant
  -- for all aircraft that got a PF entry
  UPDATE aircraft a
  SET
    performance_factor = apf.performance_factor,
    variant = apf.variant
  FROM aircraft_performance_factors apf
  WHERE a.id = apf.aircraft_id
    AND apf.period_name = 'Q1 2026';

  RAISE NOTICE 'Seeded Q1 2026 Performance Factor period successfully';
END $$;


-- ═══════════════════════════════════════════════════════════
-- VERIFY
-- ═══════════════════════════════════════════════════════════

SELECT
  a.registration,
  at.icao_type,
  apf.variant,
  apf.performance_factor AS pf,
  at.fuel_burn_rate_kg_per_hour AS base_burn,
  ROUND(at.fuel_burn_rate_kg_per_hour * (1 + apf.performance_factor / 100)) AS eff_burn
FROM aircraft_performance_factors apf
JOIN aircraft a ON apf.aircraft_id = a.id
JOIN aircraft_types at ON a.aircraft_type_id = at.id
WHERE apf.period_name = 'Q1 2026'
ORDER BY apf.performance_factor DESC;

-- Count by variant
SELECT
  apf.variant,
  COUNT(*) AS count,
  ROUND(AVG(apf.performance_factor), 1) AS avg_pf,
  MIN(apf.performance_factor) AS min_pf,
  MAX(apf.performance_factor) AS max_pf
FROM aircraft_performance_factors apf
WHERE apf.period_name = 'Q1 2026'
GROUP BY apf.variant
ORDER BY apf.variant;
