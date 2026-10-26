import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSigningSecret } from '../app/lib/secret.ts';

function withNodeEnv(value: string, fn: () => void) {
  const env = process.env as Record<string, string | undefined>;
  const prev = env.NODE_ENV;
  env.NODE_ENV = value;
  try { fn(); } finally { env.NODE_ENV = prev; }
}

test('тохируулсан нууц утгыг буцаана', () => {
  withNodeEnv('production', () => {
    assert.equal(getSigningSecret('real-secret', 'dev'), 'real-secret');
  });
});

test('production-д нууц байхгүй бол fallback ашиглахгүй, алдаа шиднэ', () => {
  withNodeEnv('production', () => {
    assert.throws(() => getSigningSecret(undefined, 'dev'), /SESSION_SECRET/);
    assert.throws(() => getSigningSecret('', 'dev'), /SESSION_SECRET/);
  });
});

test('development-д fallback ашиглана', () => {
  withNodeEnv('development', () => {
    assert.equal(getSigningSecret(undefined, 'dev'), 'dev');
  });
});
