-- ═══════════════════════════════════════════════════════════
-- ADD VARIANT FIELD TO AIRCRAFT TABLE
-- ═══════════════════════════════════════════════════════════

ALTER TABLE aircraft
ADD COLUMN IF NOT EXISTS variant text;

COMMENT ON COLUMN aircraft.variant IS
'Airbus model variant designation (e.g. 321-271NX, 321-211, 320-214). From manufacturer/FOE records.';

-- ═══════════════════════════════════════════════════════════
-- SEED VARIANTS FROM FOE PERFORMANCE FACTOR DOCUMENT
-- ═══════════════════════════════════════════════════════════

-- A321 NEO (321-271NX) — newest, most efficient
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A500';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A516';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A523';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A525';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A526';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A528';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A534';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A536';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A537';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A538';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A539';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A543';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A545';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A546';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A547';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A548';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A549';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A550';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A552';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A553';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A554';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A578';
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A580';

-- A321 NEO (321-271N) — older neo engine option
UPDATE aircraft SET variant = '321-271N' WHERE registration = 'VN-A607';
UPDATE aircraft SET variant = '321-271N' WHERE registration = 'VN-A646';
UPDATE aircraft SET variant = '321-271N' WHERE registration = 'VN-A653';
UPDATE aircraft SET variant = '321-271N' WHERE registration = 'VN-A674';
UPDATE aircraft SET variant = '321-271N' WHERE registration = 'VN-A693';
UPDATE aircraft SET variant = '321-271N' WHERE registration = 'VN-A697';

-- A321 CEO (321-211) — older, higher fuel burn
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A522';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A532';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A535';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A542';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A544';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A629';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A630';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A632';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A633';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A634';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A635';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A636';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A637';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A639';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A640';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A641';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A642';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A643';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A644';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A645';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A647';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A648';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A649';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A651';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A657';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A661';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A667';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A670';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A673';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A677';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A683';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A684';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A685';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A687';
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A698';

-- A320 CEO (320-214)
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A650';
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A655';
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A656';
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A658';
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A662';
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A663';
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A666';
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A668';
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A669';
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A671';
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A672';
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A675';
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A676';
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A689';
UPDATE aircraft SET variant = '320-214' WHERE registration = 'VN-A699';

-- ═══════════════════════════════════════════════════════════
-- AIRCRAFT IN OUR DB NOT IN FOE DOC
-- ═══════════════════════════════════════════════════════════
-- Some registrations in our seed (VN-A600-A628 range, VN-A660,
-- VN-A678-A682, VN-A810-A820) aren't in the FOE PDF.
-- Set reasonable defaults based on registration patterns:

-- VN-A600 to VN-A606, VN-A608, VN-A609 — likely 321 ceo/neo mix
-- Since these are lower-numbered 6xx regs, assume ceo
UPDATE aircraft SET variant = '321-211'
WHERE registration IN ('VN-A600','VN-A601','VN-A602','VN-A603',
  'VN-A604','VN-A605','VN-A606','VN-A608','VN-A609')
AND variant IS NULL;

-- VN-A610 to VN-A628 — mid-range, likely neo
UPDATE aircraft SET variant = '321-271NX'
WHERE registration LIKE 'VN-A6%'
AND CAST(SUBSTRING(registration FROM 5) AS integer) BETWEEN 610 AND 628
AND variant IS NULL;

-- VN-A660 — 321, assume ceo
UPDATE aircraft SET variant = '321-211' WHERE registration = 'VN-A660' AND variant IS NULL;

-- VN-A678-A682 — 320 range, assume 320-214 ceo
UPDATE aircraft SET variant = '320-214'
WHERE registration IN ('VN-A678','VN-A679','VN-A680','VN-A681','VN-A682')
AND variant IS NULL;

-- VN-A520, VN-A521 — 321, assume neo (5xx range)
UPDATE aircraft SET variant = '321-271NX'
WHERE registration IN ('VN-A520','VN-A521')
AND variant IS NULL;

-- VN-A692 — 321, likely neo
UPDATE aircraft SET variant = '321-271NX' WHERE registration = 'VN-A692' AND variant IS NULL;

-- A330 fleet (VN-A810 to VN-A820) — all 330-941 (neo) or 330-343
-- Vietjet A330s are 330-900neo
UPDATE aircraft SET variant = '330-941'
WHERE registration LIKE 'VN-A8%' AND variant IS NULL;


-- ═══════════════════════════════════════════════════════════
-- VERIFY
-- ═══════════════════════════════════════════════════════════

-- Summary by variant
SELECT
  at.icao_type,
  a.variant,
  COUNT(*) AS count,
  ROUND(AVG(a.performance_factor), 1) AS avg_pf,
  ROUND(AVG(at.fuel_burn_rate_kg_per_hour * (1 + COALESCE(a.performance_factor, 0) / 100))) AS avg_effective_burn
FROM aircraft a
JOIN aircraft_types at ON a.aircraft_type_id = at.id
GROUP BY at.icao_type, a.variant
ORDER BY at.icao_type, a.variant;

-- Any aircraft missing variant?
SELECT registration FROM aircraft WHERE variant IS NULL;
