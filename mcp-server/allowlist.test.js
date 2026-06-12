import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowed, listDomains, addDomain } from './allowlist.js';

test('allows exact domain', () => {
  assert.equal(isAllowed('https://upwork.com/jobs'), true);
});

test('allows subdomain', () => {
  assert.equal(isAllowed('https://www.upwork.com/jobs'), true);
});

test('blocks unlisted domain', () => {
  assert.equal(isAllowed('https://evil.com/steal'), false);
});

test('blocks invalid URL', () => {
  assert.equal(isAllowed('not-a-url'), false);
});

test('listDomains returns array', () => {
  const domains = listDomains();
  assert.ok(Array.isArray(domains));
  assert.ok(domains.includes('upwork.com'));
});
