import { test } from 'node:test';
import assert from 'node:assert/strict';

test('isMajorityApproved: тэнцүүгээс илүү', async () => {
  const { isMajorityApproved } = await import('../app/lib/work-plan/shared.ts');
  assert.equal(isMajorityApproved(3, 5), true);
  assert.equal(isMajorityApproved(2, 5), false);
  assert.equal(isMajorityApproved(2, 4), false); // тэнцүү — хүрэхгүй
  assert.equal(isMajorityApproved(3, 4), true);
  assert.equal(isMajorityApproved(1, 1), true);
  assert.equal(isMajorityApproved(0, 0), false); // гишүүнгүй — автоматаар батлагдахгүй
});

test('planTotals: цуцалсан ажил тооцогдохгүй', async () => {
  const { planTotals } = await import('../app/lib/work-plan/shared.ts');
  const t = planTotals([
    { status: 'done', budget: 1000, actual_cost: 900 },
    { status: 'in_progress', budget: 500, actual_cost: null },
    { status: 'cancelled', budget: 9999, actual_cost: 50 },
  ]);
  assert.deepEqual(t, { count: 2, done: 1, budget: 1500, actual: 900 });
});

test('isWorkPlanEnabled: зөвхөн туршилтын СӨХ', async () => {
  const { isWorkPlanEnabled } = await import('../app/lib/work-plan/shared.ts');
  assert.equal(isWorkPlanEnabled(2694), true);
  assert.equal(isWorkPlanEnabled('2694'), true);
  assert.equal(isWorkPlanEnabled(2690), false);
  assert.equal(isWorkPlanEnabled(null), false);
});
