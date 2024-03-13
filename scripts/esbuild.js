const { build } = require('esbuild')

build({
  platform: 'node',
  minify: false,
  bundle: true,
  sourcemap: false,
  outfile: 'indexer.js',
  entryPoints: ['scripts/indexer.ts']
}).catch((e) => {
  console.error(e)
  process.exit(1)
})
