import assert from 'node:assert/strict';
import test from 'node:test';

import { cosineTextSimilarity, rankModifierMatches } from '../src/index.ts';

const modifiers = [
  { id: 'cheddar', name: 'Cheddar Cheese', group_name: 'Cheese' },
  { id: 'swiss', name: 'Swiss Cheese', group_name: 'Cheese' },
  { id: 'ranch', name: 'Ranch', group_name: 'Sauces' },
  { id: 'rare', name: 'Medium Rare', group_name: 'Temperature' },
];

const search = (query: string) => rankModifierMatches(modifiers, query, {
  aliases: (modifier) => [modifier.group_name],
});

test('ranks exact, prefix, and contained names first', () => {
  assert.deepEqual(search('ranch').map(({ modifier }) => modifier.id), ['ranch']);
  assert.deepEqual(search('cheddar').map(({ modifier }) => modifier.id), ['cheddar']);
  assert.deepEqual(search('cheese').map(({ modifier }) => modifier.id), ['cheddar', 'swiss']);
});

test('finds useful misspellings using character cosine similarity', () => {
  assert.ok(cosineTextSimilarity('cheze', 'cheese') > 0.5);
  assert.deepEqual(search('cheze').map(({ modifier }) => modifier.id), ['cheddar', 'swiss']);
  assert.equal(search('motor oil').length, 0);
});

test('searches modifier categories with lower weight', () => {
  assert.deepEqual(search('temperature').map(({ modifier }) => modifier.id), ['rare']);
});

test('returns the original order for an empty query', () => {
  assert.deepEqual(search('').map(({ modifier }) => modifier.id), modifiers.map(({ id }) => id));
});
