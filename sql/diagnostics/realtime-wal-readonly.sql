-- Realtime / WAL / query эх үүсвэрийн оношилгоо — ЗӨВХӨН УНШИХ (SELECT).
-- Supabase SQL Editor-т хэсэг хэсгээр ажиллуулж, үр дүнг аудитад хавсаргана.
-- Юу ч өөрчлөхгүй. (2026-11-01, Disk IO аудит)

-- 1. Query-г ЭХ ҮҮСВЭРЭЭР нь ангилах: role-оор бүлэглэнэ.
--    authenticator / anon / authenticated  → PostgREST (апп-ын API хүсэлт)
--    supabase_admin / supabase_realtime_admin → Supabase internal (Realtime, Studio, мониторинг)
--    postgres → SQL Editor / Studio / скрипт
SELECT r.rolname,
       count(*)                                   AS distinct_queries,
       sum(s.calls)                               AS calls,
       round(sum(s.total_exec_time)::numeric/1000) AS total_sec,
       round(sum(s.shared_blks_read)*8/1024.0, 1)  AS disk_read_mb,
       round(sum(s.wal_bytes)/1024.0/1024.0, 1)    AS wal_mb
FROM pg_stat_statements s JOIN pg_roles r ON r.oid = s.userid
GROUP BY r.rolname
ORDER BY total_sec DESC;

-- 2. Шилдэг 15 query + role (WAL, timezone, set_config хэнийх болохыг харуулна)
SELECT r.rolname, s.calls,
       round(s.total_exec_time::numeric/1000) AS total_sec,
       round(s.mean_exec_time::numeric, 1)    AS mean_ms,
       round(s.max_exec_time::numeric)        AS max_ms,
       round(s.shared_blks_read*8/1024.0, 1)  AS disk_read_mb,
       left(regexp_replace(s.query, '\s+', ' ', 'g'), 160) AS query
FROM pg_stat_statements s JOIN pg_roles r ON r.oid = s.userid
ORDER BY s.total_exec_time DESC
LIMIT 15;

-- 3. Realtime publication-д ямар хүснэгт байгаа вэ (FOR ALL TABLES бол бүх бичилт decode хийгдэнэ)
SELECT pubname, puballtables, pubinsert, pubupdate, pubdelete FROM pg_publication;
SELECT pubname, schemaname, tablename FROM pg_publication_tables ORDER BY 1, 2, 3;

-- 4. Replication slot-ууд: хэдэн WAL барьж байгаа, идэвхтэй эсэх
SELECT slot_name, plugin, slot_type, active, active_pid,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn))         AS retained_wal,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn)) AS unconfirmed,
       wal_status
FROM pg_replication_slots;

-- 5. Realtime-ийн идэвхтэй postgres_changes subscription-ууд (хүснэгт бүрээр)
SELECT entity::regclass AS tbl, count(*) AS subscriptions, min(created_at) AS oldest, max(created_at) AS newest
FROM realtime.subscription
GROUP BY 1 ORDER BY 2 DESC;

-- 6. WAL үүсэлтийн хурд (stats_reset-ээс хойш) ба checkpoint
SELECT wal_records, pg_size_pretty(wal_bytes) AS wal_total, wal_buffers_full, stats_reset,
       pg_size_pretty((wal_bytes / greatest(extract(epoch FROM now() - stats_reset), 1) * 86400)::bigint) AS wal_per_day
FROM pg_stat_wal;
SELECT name, setting, unit FROM pg_settings
WHERE name IN ('max_wal_size','min_wal_size','wal_keep_size','max_slot_wal_keep_size',
               'checkpoint_timeout','wal_level','shared_buffers','effective_cache_size');

-- 7. Хамгийн их бичигддэг хүснэгтүүд (WAL-ийн эх үүсвэр)
SELECT schemaname, relname, n_tup_ins, n_tup_upd, n_tup_del, n_tup_hot_upd, n_dead_tup
FROM pg_stat_all_tables
WHERE schemaname NOT IN ('pg_catalog','information_schema','pg_toast')
ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC
LIMIT 20;

-- 8. pg_stat_statements хэдэн хоногийн өгөгдөл вэ (дуудлагын тоог өдөрт хөрвүүлэхэд)
SELECT stats_reset, now() - stats_reset AS window FROM pg_stat_statements_info;
