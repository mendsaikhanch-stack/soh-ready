-- «Үйлчилгээ тохиргоо» (/admin/features): СӨХ-ийн идэвхгүй болгосон модулиуд.
-- supabase-elevator-salary.sql-д байсан ч production-д ажиллуулаагүй тул багана байхгүй,
-- тохиргоо хадгалагдахгүй байв (2026-11-27). Зөвхөн энэ баганыг нэмнэ.
ALTER TABLE sokh_organizations ADD COLUMN IF NOT EXISTS disabled_features TEXT[] DEFAULT '{}';
