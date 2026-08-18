import assert from 'node:assert/strict'
import test from 'node:test'

import {
  bucketItemsByCategoryIdentity,
  categoryKeyForCategory,
  effectiveItemCategoryName,
  orphanCategoryBucketsFromIdentity,
} from './menuCategoryIdentity.js'

const beer = { id: 'cat-beer', name: 'Draft Beer' }
const wine = { id: 'cat-wine', name: 'Wine' }
const categoriesById = { [beer.id]: beer, [wine.id]: wine }

test('linked items follow a renamed category by stable id', () => {
  const item = { id: 'jack', name: 'Jack', category: 'Beer', menu_category_id: beer.id }

  assert.equal(effectiveItemCategoryName(item, categoriesById), 'Draft Beer')
  assert.deepEqual(bucketItemsByCategoryIdentity([item], categoriesById), {
    [categoryKeyForCategory(beer)]: [item],
  })
})

test('legacy items without a category id still fall back to category name', () => {
  const item = { id: 'pinot', name: 'Pinot', category: 'Wine', menu_category_id: null }

  assert.equal(effectiveItemCategoryName(item, categoriesById), 'Wine')
  assert.deepEqual(bucketItemsByCategoryIdentity([item], categoriesById), {
    'name:wine': [item],
  })
})

test('orphan buckets do not flag renamed linked items', () => {
  const linked = { id: 'jack', name: 'Jack', category: 'Beer', menu_category_id: beer.id }
  const orphan = { id: 'chips', name: 'Chips', category: 'Snacks', menu_category_id: null }

  assert.deepEqual(orphanCategoryBucketsFromIdentity([linked, orphan], [beer, wine], categoriesById), [
    ['Snacks', [orphan]],
  ])
})

test('items linked to a missing category id stay visible as orphans', () => {
  const staleLink = { id: 'lager', name: 'Lager', category: 'Draft Beer', menu_category_id: 'missing-category' }

  assert.deepEqual(orphanCategoryBucketsFromIdentity([staleLink], [beer, wine], categoriesById), [
    ['Draft Beer', [staleLink]],
  ])
})
