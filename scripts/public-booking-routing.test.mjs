import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const expectedRedirects = [
  ['/book', 'https://shire-reservations.vercel.app/reserve'],
  ['/book/', 'https://shire-reservations.vercel.app/reserve'],
  ['/book/:slug', 'https://shire-reservations.vercel.app/book/:slug'],
  ['/book/:slug/', 'https://shire-reservations.vercel.app/book/:slug'],
]

for (const configPath of ['vercel.json', 'apps/web/vercel.json']) {
  test(`${configPath} redirects every legacy booking route to the canonical app`, async () => {
    const config = JSON.parse(await readFile(new URL(`../${configPath}`, import.meta.url), 'utf8'))
    const redirects = new Map(
      (config.redirects || []).map(({ source, destination, permanent }) => [
        source,
        { destination, permanent },
      ]),
    )

    for (const [source, destination] of expectedRedirects) {
      assert.deepEqual(redirects.get(source), { destination, permanent: true })
    }
    assert.equal(
      (config.rewrites || []).some(({ source }) => source.startsWith('/book')),
      false,
    )
  })
}
