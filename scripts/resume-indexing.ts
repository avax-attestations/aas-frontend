import cp from 'child_process';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

import { program } from 'commander'
import { DEPLOYMENT, type Chain } from "@/lib/config";
import { normalizeChainName as normalizeChainName } from '@/lib/utils';

program
  .requiredOption('-b, --base-url <base-url>', 'Base URL to fetch indexing checkpoints')

const parsed = program.parse(process.argv)
const opts = parsed.opts()

const streamPipeline = promisify(pipeline);

async function fetchFile(baseURL: string, filename: string, outDir: string) {
  const url = `${baseURL}/${filename}`
  const outPath = path.join(outDir, filename)

  console.log(`download ${url} to ${outPath}`);
  const response = await fetch(url);

  if (!response.ok || response.body === null) {
    console.error(`Failed to download ${url}: ${response.statusText}`);
    return Promise.resolve(null);
  }

  return streamPipeline(response.body as any, fs.createWriteStream(outPath));
}

async function runChain(chain: Chain) {
  const outDir = `./out/indexing/${normalizeChainName(chain)}`
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const baseURL = `${opts.baseUrl.replace('/$','')}/indexing/${normalizeChainName(chain)}`

  await fetchFile(baseURL, 'index.db', outDir)
  await fetchFile(baseURL, 'index.json', outDir)
  const indexJson = JSON.parse(fs.readFileSync(`${outDir}/index.json`, 'utf-8'))

  for (const checkpoint of indexJson) {
    await fetchFile(baseURL, `${checkpoint.hash}.json`, outDir)
  }

  const indexingProcess = cp.spawn(process.execPath, ['indexer.js', '-c', chain, outDir], {
    stdio: 'inherit'
  })

  // Since we have already downloaded the previous checkout,
  // we don't care if the indexing job fails, just wait for it to finish.
  // Failures are common since RPC endpoints might rate limit our IP.
  return new Promise((resolve) => {
    indexingProcess.on('exit', resolve)
  })
}

async function run() {
  const promises = []

  for (const key of Object.keys(DEPLOYMENT)) {
    if (key !== 'Hardhat') {
      promises.push(runChain(key as Chain))
    }
  }

  await Promise.all(promises)
}

run().then(() => {
  console.log('Done indexing all chains')
}).catch((err) => {
  console.error('Failed to index', err)
  process.exit(1)
})
