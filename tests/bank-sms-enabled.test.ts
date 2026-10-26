import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBankSmsEnabled } from '../app/lib/bank-sms/enabled.ts';

test('банкны SMS зөвхөн жагсаалтад байгаа СӨХ-д', () => {
  assert.equal(isBankSmsEnabled(2694), true);
  assert.equal(isBankSmsEnabled('2694'), true);
  assert.equal(isBankSmsEnabled(2697), false);
  assert.equal(isBankSmsEnabled(0), false);
  assert.equal(isBankSmsEnabled(null), false);
  assert.equal(isBankSmsEnabled(undefined), false);
  assert.equal(isBankSmsEnabled('2694abc'), false);
});
