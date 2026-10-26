-- Disk I/O оношилгоо — ЗӨВХӨН УНШИХ (SELECT). Supabase SQL Editor-т хэсэг хэсгээр ажиллуул.
-- Юу ч өөрчлөхгүй, өгөгдөл устгахгүй. Үр дүнг CSV-ээр татаж аудитад хавсарга.

-- 0. pg_stat_statements идэвхтэй эсэх (Supabase-д анхнаасаа асаалттай байдаг)
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_stat_statements','pg_cron','pg_net');

-- 1. Хамгийн их диск уншдаг query-ууд (shared_blks_read = cache-д байгаагүй тул дискнээс уншсан блок)
SELECT
  round(shared_blks_read * 8 / 1024.0, 1)    AS disk_read_mb,
  round(shared_blks_written * 8 / 1024.0, 1) AS disk_write_mb,
  round(temp_blks_written * 8 / 1024.0, 1)   AS temp_write_mb,
  calls,
  round(total_exec_time::numeric, 0)         AS total_ms,
  rows,
  left(regexp_replace(query, '\s+', ' ', 'g'), 220) AS query
FROM pg_stat_statements
ORDER BY shared_blks_read + shared_blks_written + temp_blks_written DESC
LIMIT 30;

-- 2. Хамгийн олон дуудагдсан query-ууд (polling/refetch илрүүлэх)
SELECT calls, round(mean_exec_time::numeric, 2) AS mean_ms, rows,
       round(shared_blks_hit * 8 / 1024.0, 1) AS cache_hit_mb,
       left(regexp_replace(query, '\s+', ' ', 'g'), 220) AS query
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 30;

-- 3. WAL / бичилт ихтэй query-ууд (INSERT/UPDATE давтамж)
SELECT calls, rows, round(wal_bytes / 1024.0 / 1024.0, 1) AS wal_mb,
       left(regexp_replace(query, '\s+', ' ', 'g'), 220) AS query
FROM pg_stat_statements
WHERE wal_bytes > 0
ORDER BY wal_bytes DESC
LIMIT 20;

-- 4. Хүснэгт бүрийн seq scan / бичилт / dead tuple
SELECT schemaname, relname,
       seq_scan, seq_tup_read, idx_scan,
       n_tup_ins, n_tup_upd, n_tup_del, n_live_tup, n_dead_tup,
       last_autovacuum, last_autoanalyze,
       pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
ORDER BY seq_tup_read DESC
LIMIT 40;

-- 5. Хамгийн том хүснэгтүүд (бүх schema: auth, storage, realtime, cron, net гэх мэт)
SELECT n.nspname AS schema, c.relname,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r','m')
ORDER BY pg_total_relation_size(c.oid) DESC
LIMIT 25;

-- 6. Ашиглагдаагүй индексүүд (бичилт бүрд I/O нэмдэг)
SELECT schemaname, relname, indexrelname, idx_scan,
       pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 30;

-- 7. Cache hit ratio (0.99-өөс бага бол RAM хүрэлцэхгүй байна гэсэн үг)
SELECT 'table' AS kind,
       round(sum(heap_blks_hit)::numeric / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 4) AS ratio
FROM pg_statio_user_tables
UNION ALL
SELECT 'index',
       round(sum(idx_blks_hit)::numeric / nullif(sum(idx_blks_hit) + sum(idx_blks_read), 0), 4)
FROM pg_statio_user_indexes;

-- 8. Checkpoint / background writer (бичилтийн ерөнхий ачаалал)
SELECT * FROM pg_stat_bgwriter;

-- 9. Одоогийн холболтууд (хэн, хэдэн ширхэг)
SELECT usename, application_name, state, count(*)
FROM pg_stat_activity
GROUP BY 1, 2, 3
ORDER BY 4 DESC;

-- 10. Статистик хэзээнээс хуримтлагдсан (reset хийсэн огноо)
SELECT stats_reset FROM pg_stat_database WHERE datname = current_database();
