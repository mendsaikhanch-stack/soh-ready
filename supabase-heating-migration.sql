-- Дулааны тооцоолуур: residents хүснэгтэд area_sqm (мкв) нэмэх
-- Supabase SQL Editor дотор ажиллуулна

-- 1. area_sqm талбар нэмэх
ALTER TABLE residents ADD COLUMN IF NOT EXISTS area_sqm NUMERIC DEFAULT 0;

-- 2. Жишээ өгөгдөл шинэчлэх (бүх оршин суугчдад 45 мкв default өгөх)
-- UPDATE residents SET area_sqm = 45 WHERE area_sqm = 0;

-- 3. Дулааны тарифыг мкв-аар тохируулах (хуучин Гкал тарифуудыг устгаж болно)
-- Жишээ: өвлийн тариф 3500₮/мкв
-- INSERT INTO utility_tariffs (sokh_id, utility_type, rate_per_unit, unit, effective_from)
-- VALUES (1, 'heating', 3500, 'мкв', '2025-10-01');
