-- ХОТОЛ — demo хэрэглэгч + demo дата (нэг скриптээр)
-- Demo login:  Утас 88000000  /  Нууц үг Demo12345!
-- Supabase SQL Editor-т бүхэлд нь хуулж Run хийнэ. Дахин ажиллуулж болно.

set search_path = public, extensions;

DO $$
DECLARE
  v_uid  uuid;
  v_sokh bigint;
BEGIN
  -- 1) auth хэрэглэгч үүсгэх эсвэл нууц үг/баталгаажуулалтыг засах
  SELECT id INTO v_uid FROM auth.users WHERE email = '88000000@toot.app';

  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated',
      '88000000@toot.app', crypt('Demo12345!', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      '{"phone":"88000000"}'
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_uid,
      jsonb_build_object('sub', v_uid::text, 'email', '88000000@toot.app'),
      'email', v_uid::text, now(), now(), now()
    );
  ELSE
    UPDATE auth.users
      SET encrypted_password = crypt('Demo12345!', gen_salt('bf')),
          email_confirmed_at = now()
      WHERE id = v_uid;
  END IF;

  -- 2) demo дата
  DELETE FROM sokh_organizations WHERE name = 'Туршилтын СӨХ — Хотол демо байр';

  INSERT INTO sokh_organizations (name, address, phone)
  VALUES ('Туршилтын СӨХ — Хотол демо байр',
          'Улаанбаатар, СБД, 1-р хороо, Демо гудамж 12', '77000000')
  RETURNING id INTO v_sokh;

  INSERT INTO residents (name, apartment, phone, debt, area_sqm, sokh_id, auth_user_id)
  VALUES ('Та (демо хэрэглэгч)', '12', '88000000', 0, 45, v_sokh, v_uid);

  INSERT INTO residents (name, apartment, phone, debt, area_sqm, sokh_id) VALUES
    ('Бат (демо)',      '24', '88000001',  45000, 62, v_sokh),
    ('Сараа (демо)',    '36', '88000002',      0, 58, v_sokh),
    ('Дорж (демо)',     '41', '88000003', 120000, 74, v_sokh),
    ('Оюун (демо)',     '52', '88000004',      0, 48, v_sokh),
    ('Ганаа (демо)',    '63', '88000005',  30000, 55, v_sokh),
    ('Тэмүүлэн (демо)', '18', '88000006',      0, 66, v_sokh),
    ('Нараа (демо)',    '29', '88000007',  75000, 52, v_sokh);

  INSERT INTO payments (resident_id, amount, description, paid_at)
  SELECT id, 50000, 'Сарын үйлчилгээний хураамж — 2026.05', NOW() - INTERVAL '20 days'
    FROM residents WHERE sokh_id = v_sokh AND apartment = '12';
  INSERT INTO payments (resident_id, amount, description, paid_at)
  SELECT id, 50000, 'Сарын үйлчилгээний хураамж — 2026.04', NOW() - INTERVAL '50 days'
    FROM residents WHERE sokh_id = v_sokh AND apartment = '12';
  INSERT INTO payments (resident_id, amount, description, paid_at)
  SELECT id, 50000, 'Сарын үйлчилгээний хураамж — 2026.05', NOW() - INTERVAL '18 days'
    FROM residents WHERE sokh_id = v_sokh AND apartment = '24';
  INSERT INTO payments (resident_id, amount, description, paid_at)
  SELECT id, 50000, 'Сарын үйлчилгээний хураамж — 2026.05', NOW() - INTERVAL '15 days'
    FROM residents WHERE sokh_id = v_sokh AND apartment = '36';
  INSERT INTO payments (resident_id, amount, description, paid_at)
  SELECT id, 75000, 'Дулааны төлбөр — 2026.05', NOW() - INTERVAL '12 days'
    FROM residents WHERE sokh_id = v_sokh AND apartment = '52';
  INSERT INTO payments (resident_id, amount, description, paid_at)
  SELECT id, 50000, 'Сарын үйлчилгээний хураамж — 2026.05', NOW() - INTERVAL '9 days'
    FROM residents WHERE sokh_id = v_sokh AND apartment = '18';

  INSERT INTO announcements (sokh_id, title, content, type) VALUES
    (v_sokh, 'Цэвэр усны хязгаарлалт',
     'Маргааш 10:00–16:00 цагт цэвэр ус хязгаарлагдана. Урьдчилан усаа нөөцлөнө үү.', 'info'),
    (v_sokh, 'Хог ачих цагийн өөрчлөлт',
     'Энэ сараас хог ачих цаг өглөө 08:00 болж өөрчлөгдлөө.', 'info'),
    (v_sokh, 'Орцны хаалганы код шинэчлэгдсэн',
     'Аюулгүй байдлын үүднээс орцны код шинэчлэгдлээ. Удирдлагатай холбогдоно уу.', 'info'),
    (v_sokh, 'СӨХ-ийн ээлжит хурал',
     '2026 оны 06 сарын 25-ны 19:00 цагт 1 давхрын танхимд хурал болно.', 'event');

  INSERT INTO complaints (sokh_id, category, title, description, status, admin_reply, replied_at) VALUES
    (v_sokh, 'complaint', 'Лифт ажиллахгүй байна',
     'Баруун талын лифт 2 өдөр зогссон байна.', 'resolved',
     'Засварын баг засаж дууслаа. Лифт хэвийн ажиллаж байна.', NOW() - INTERVAL '1 day'),
    (v_sokh, 'complaint', 'Дээврээс ус гоожиж байна',
     'Дээд давхрын тааз чийгшиж байна.', 'in_progress',
     'Дээврийн засварын ажлыг төлөвлөж байна.', NOW() - INTERVAL '3 days'),
    (v_sokh, 'complaint', 'Орцны гэрэл асахгүй',
     '3-р орцны 5 давхрын гэрэл асахгүй байна.', 'pending', NULL, NULL);

  INSERT INTO maintenance_requests (sokh_id, title, description, status) VALUES
    (v_sokh, 'Дээврийн засвар', 'Дээврийн ус нэвчилтийг засах шаардлагатай.', 'pending'),
    (v_sokh, 'Гадна талбайн гэрэлтүүлэг', 'Зогсоолын гэрэлтүүлгийг суурилуулж дууссан.', 'done');

  RAISE NOTICE 'Done. demo_uid=%, sokh_id=%', v_uid, v_sokh;
END $$;
