-- Даргын сүүлийн нэвтрэлт
--
-- Яагаад: суперадмин дээр «энэ СӨХ-ийн дарга системээ хэрэглэж байна уу»
-- гэдгийг харах ганц ч бодит өгөгдөл байгаагүй. Оршин суугчийн талыг
-- Supabase Auth-ийн last_sign_in_at-аас уншиж болдог ч admin_users нь
-- өөрийн хүснэгт тул энд гараар тэмдэглэнэ.
--
-- Хаана бичигдэх вэ: app/api/auth/login/route.ts — нэвтрэлт амжилттай
-- болмогц (алдаа гарвал нэвтрэлтийг унагаахгүй, зүгээр алгасна).
--
-- Supabase → SQL Editor дээр ГАРААР ажиллуулна.

alter table public.admin_users
  add column if not exists last_login_at timestamptz;

comment on column public.admin_users.last_login_at is
  'Сүүлд амжилттай нэвтэрсэн огноо. /api/auth/login бичнэ.';
