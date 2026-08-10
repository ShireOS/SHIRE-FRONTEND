import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const publicRoot = join(dirname(fileURLToPath(import.meta.url)), '../../public')
const repoRoot = join(publicRoot, '../../..')

function textFiles(root) {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name)
    if (entry.isDirectory()) return textFiles(path)
    return /\.(?:css|html|js)$/.test(entry.name) ? [path] : []
  })
}

test('Vercel SPA fallbacks preserve packaged preview files', () => {
  for (const path of [join(repoRoot, 'vercel.json'), join(repoRoot, 'apps/web/vercel.json')]) {
    const config = JSON.parse(readFileSync(path, 'utf8'))
    const fallback = config.rewrites.at(-1)
    assert.match(fallback.source, /previews\//)
    assert.equal(fallback.destination, '/index.html')
  }
})

for (const service of ['pos', 'host']) {
  test(`${service} preview has isolated, resolvable assets`, () => {
    const basePath = `/previews/${service}`
    const root = join(publicRoot, 'previews', service)
    const files = textFiles(root)
    const contents = files.map((path) => readFileSync(path, 'utf8'))
    const index = readFileSync(join(root, 'index.html'), 'utf8')
    const assetUrls = [...index.matchAll(/(?:href|src)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((url) => url.startsWith(basePath))

    assert.ok(assetUrls.length > 0)
    for (const url of assetUrls) {
      assert.equal(existsSync(join(publicRoot, url)), true, `${url} is missing`)
    }
    assert.ok(contents.some((content) => content.includes(`${basePath}/`)))
    assert.equal(contents.some((content) => /["'(]\/_(?:expo)\//.test(content)), false)
    assert.equal(contents.some((content) => /["'(]\/assets\//.test(content)), false)
    if (service === 'host') assert.match(index, /history\.replaceState/)
  })
}
