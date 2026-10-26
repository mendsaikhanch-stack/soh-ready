-- ============================================================
-- «АйСиТаун» (ICTown) СӨХ (#2694) — гүйлгээний утга → байр-орц-тоот
-- ЭХНИЙ ДҮРМҮҮД. supabase-bank-sms-migration.sql-ийн ДАРАА ажиллуулна.
-- Supabase ▸ SQL Editor ▸ Run.  Давтан ажиллуулахад аюулгүй.
--
-- Эх сурвалж: СӨХ-ийн баталгаажуулсан бизнесийн дүрэм (2026-10-25).
-- residents.building нь «блок-орц» (жишээ 2-2), apartment нь тоот.
--
-- normalized_pattern = normalizeReference(source_pattern)
--   (app/lib/bank-sms/core.ts — том үсэг, кирилл→латин, зай/цэг хасна).
-- Дараагийн дүрмүүдийг /admin/bank-sms ▸ «Тоот таних дүрэм»-ээс нэмнэ —
-- тэнд normalized_pattern-ийг апп өөрөө тооцно.
-- ============================================================

INSERT INTO payment_reference_mappings
  (sokh_id, source_pattern, normalized_pattern, building_number, entrance_number, apartment_number, note)
SELECT 2694, v.source_pattern, v.normalized_pattern, v.building, v.entrance, v.apartment,
       'Анхны дүрэм (СӨХ баталгаажуулсан, 2026-10-25)'
  FROM (VALUES
    ('613тоот',             '613TOOT',         '2', '2', '613'),
    ('907 TOOT',            '907TOOT',         '1', '1', '907'),
    ('403 TOOT',            '403TOOT',         '3', '1', '403'),
    ('203 R BAIR 403 TOOT', '203RBAIR403TOOT', '3', '1', '403'),
    ('498/1-404',           '498/1-404',       '1', '1', '404')
  ) AS v(source_pattern, normalized_pattern, building, entrance, apartment)
 WHERE EXISTS (SELECT 1 FROM sokh_organizations WHERE id = 2694)
   AND NOT EXISTS (
     SELECT 1 FROM payment_reference_mappings m
      WHERE m.sokh_id = 2694 AND m.normalized_pattern = v.normalized_pattern AND m.is_active
   );

-- ШАЛГАХ: 5 мөр, тус бүр residents-д ЯГ НЭГ «даргын» мөртэй таарах ёстой
-- SELECT m.source_pattern, m.building_number || '-' || m.entrance_number || '-' || m.apartment_number AS unit,
--        COUNT(r.id) FILTER (WHERE r.floor IS NOT NULL AND r.floor <> '' AND NOT COALESCE(r.pending_claim, false)) AS owner_rows,
--        COUNT(r.id) AS all_rows
--   FROM payment_reference_mappings m
--   LEFT JOIN residents r ON r.sokh_id = m.sokh_id
--        AND r.building = m.building_number || '-' || m.entrance_number
--        AND r.apartment = m.apartment_number
--  WHERE m.sokh_id = 2694
--  GROUP BY 1, 2 ORDER BY 2;
