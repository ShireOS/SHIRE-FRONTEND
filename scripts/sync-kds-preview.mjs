import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const sourceDirectory = resolve(repositoryRoot, process.argv[2] || '../Shire_KDS/dist-web')
const targetDirectory = resolve(repositoryRoot, 'apps/web/public/previews/kds')
const manifestPath = resolve(repositoryRoot, 'apps/web/public/previews/manifest.json')
const sourceCommit = String(process.env.KDS_SOURCE_COMMIT || 'staged-worktree').trim()

const sourceIndex = await readFile(resolve(sourceDirectory, 'index.html'), 'utf8')
if (!sourceIndex.includes('<div id="root"></div>')) throw new Error('KDS preview export does not contain an Expo web root')

await rm(targetDirectory, { recursive: true, force: true })
await mkdir(targetDirectory, { recursive: true })
await cp(sourceDirectory, targetDirectory, { recursive: true })
await writeFile(
  resolve(targetDirectory, 'index.html'),
  sourceIndex.replaceAll('"/_expo/', '"/previews/kds/_expo/'),
  'utf8',
)

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const kdsPackage = JSON.parse(await readFile(resolve(repositoryRoot, '../Shire_KDS/package.json'), 'utf8'))
manifest.generated_at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
manifest.exports = manifest.exports || {}
manifest.exports.kds = {
  base_path: '/previews/kds',
  source_commit: sourceCommit,
  expo_version: String(kdsPackage.dependencies?.expo || '').replace(/^[^0-9]*/, ''),
}
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

console.log(`Copied the bundled KDS preview to ${targetDirectory}`)
