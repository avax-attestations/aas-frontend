const { build } = require('esbuild')

async function run() {
  await build({
    platform: 'node',
    minify: false,
    bundle: true,
    sourcemap: false,
    outfile: 'indexer.js',
    entryPoints: ['scripts/indexer.ts']
  })

  await build({
    platform: 'node',
    minify: false,
    bundle: true,
    sourcemap: false,
    outfile: 'resume-indexing.js',
    entryPoints: ['scripts/resume-indexing.ts']
  })
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
