import cp from 'child_process';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

import { program } from 'commander'
import { DEPLOYMENT, type Chain } from "@/lib/config";
import { normalizeChainName as normalizeChainName } from '@/lib/utils';

program
  .option('--allow-start-from-scratch', 'If set, it is possible to start from scratch (i.e. without index.db)')
  .requiredOption('-b, --base-url <base-url>', 'Base URL to fetch indexing checkpoints')

const parsed = program.parse(process.argv)
const opts = parsed.opts()

const streamPipeline = promisify(pipeline);

async function fetchFile(baseURL: string, filename: string, outDir: string) {
  const url = `${baseURL}/${filename}`
  const outPath = path.join(outDir, filename)
  const tmpPath = `${outPath}.tmp`

  const response = await fetch(url);

  if (!response.ok || response.body === null) {
    console.error(`Failed to download ${url}: ${response.statusText}`);
    return Promise.resolve(null);
  }

  await streamPipeline(response.body as any, fs.createWriteStream(tmpPath));
  fs.renameSync(tmpPath, outPath);
  console.log(`downloaded ${url} to ${outPath}`);
}

async function runChain(chain: Chain) {
  const outDir = `./out/indexing/${normalizeChainName(chain)}`
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const baseURL = `${opts.baseUrl.replace('/$', '')}/indexing/${normalizeChainName(chain)}`

  await fetchFile(baseURL, 'index.db', outDir)
  if (!fs.existsSync(`${outDir}/index.db`) && !opts.allowStartFromScratch) {
    throw new Error('Failed to download index.db (if starting from scratch, pass --allow-start-from-scratch)')
  }

  await fetchFile(baseURL, 'index.json', outDir)
  const indexJson = (() => {
    try {
      return JSON.parse(fs.readFileSync(`${outDir}/index.json`, 'utf-8'))
    } catch (e) {
      console.error(`Failed to parse index.json for "${chain}"`, e)
      return []
    }
  })()

  for (const checkpoint of indexJson) {
    await fetchFile(baseURL, `${checkpoint.hash}.json`, outDir)
  }

  const indexingProcess = cp.spawn(process.execPath, ['indexer.js', '-c', chain, outDir], {
    stdio: 'inherit'
  })

  const timeoutSeconds = 50 * 60  // kill after 50 minutes
  setTimeout(() => {
    console.log(`Killing indexing process for "${chain}" after ${timeoutSeconds} seconds`)
    indexingProcess.kill('SIGUSR1')
  }, timeoutSeconds * 1000)

  // Since we have already downloaded the previous checkout,
  // we don't care if the indexing job fails, just wait for it to finish.
  // Failures are common since RPC endpoints might rate limit our IP.
  const exitPromise = new Promise((resolve) => {
    indexingProcess.on('exit', resolve)
  })

  return exitPromise
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
  process.exit(0)
}).catch((err) => {
  console.error('Failed to index', err)
  process.exit(1)
})
