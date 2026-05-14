-- ============================================================
-- Khotol Automation Runtime — automation_runs өргөтгөл
-- ============================================================
-- Зорилго: Idempotency, review queue lifecycle, болон cron lookup-д
-- зориулсан index-ийг нэмэх.
--
-- Шинэ багана:
--   1. automation_runs.idempotency_key — давхар run үүсэхээс хамгаалах
--   2. automation_runs.reviewed_status  — review queue lifecycle
--      (pending_review | approved | rejected | sent_manually)
--   3. automation_runs.reviewed_by      — шалгасан хэрэглэгчийн id
--   4. automation_runs.reviewed_at      — шалгасан огноо
--
-- Idempotent — IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ============================================================

-- ============================================================
-- 1. Шинэ багана нэмэх
-- ============================================================

ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS reviewed_status TEXT
    DEFAULT 'pending_review'
    CHECK (reviewed_status IN (
      'pending_review',
      'approved',
      'rejected',
      'sent_manually'
    ));

ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- ============================================================
-- 2. Unique index — idempotency
-- ============================================================
-- Ижил idempotency_key-тэй pending/success run-уудыг давтахгүй.
-- Failed run дахин оролдох боломжтой (тиймээс зөвхөн success-д unique).

CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_idempotency_uniq
  ON automation_runs(rule_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL
    AND status IN ('pending', 'success');

-- ============================================================
-- 3. Review queue lookup-д зориулсан index
-- ============================================================

CREATE INDEX IF NOT EXISTS automation_runs_review_idx
  ON automation_runs(sokh_id, reviewed_status, created_at DESC)
  WHERE reviewed_status = 'pending_review';

-- ============================================================
-- 4. Комментүүд
-- ============================================================

COMMENT ON COLUMN automation_runs.idempotency_key IS
  'Давхар run үүсгэхээс сэргийлэх түлхүүр. '
  'Жишээ: "monthly:42:2026-05", "unpaid:42:2026-05", '
  '"issue_overdue:42:2026-05-14"';

COMMENT ON COLUMN automation_runs.reviewed_status IS
  'pending_review (анх үүсгэгдсэн) | approved | rejected | sent_manually';
