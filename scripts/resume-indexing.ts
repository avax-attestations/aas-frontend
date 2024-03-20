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

async function fetchRawFile(baseURL: string, filename: string, outDir: string) {
  const url = `${baseURL}/${filename}`
  const outPath = path.join(outDir, filename)
  const tmpPath = `${outPath}.tmp`

  const response = await fetch(url);

  if (!response.ok || response.body === null) {
    console.error(`Failed to download ${url}: ${response.statusText}`);
    return false;
  }

  await streamPipeline(response.body as any, fs.createWriteStream(tmpPath));
  fs.renameSync(tmpPath, outPath);
  console.log(`downloaded ${url} to ${outPath}`);
  return true
}

async function invokeProcess(
  executable: string,
  args: string[],
  timeoutSeconds?: number,
  killSignal?: NodeJS.Signals
) {
  const process = cp.spawn(executable, args, { stdio: 'inherit' })

  if (timeoutSeconds) {
    setTimeout(() => {
      process.kill(killSignal)
    }, timeoutSeconds * 1000)
  }

  const exitPromise = new Promise((resolve) => {
    process.on('exit', resolve)
  })
  return exitPromise
}

async function fetchFile(baseURL: string, filename: string, outDir: string, decompress: boolean) {
  // first try to download the .gz file
  const result = await fetchRawFile(baseURL, `${filename}.gz`, outDir)
  // if it worked, invoke gunzip to decompress it
  if (result) {
    if (decompress) {
      await invokeProcess('gunzip', ['-vf', `${outDir}/${filename}.gz`])
    }
    return
  }

  // Didn't work, try to download the uncompressed file
  await fetchRawFile(baseURL, filename, outDir)
}

async function indexChain(chain: Chain) {
  const outDir = `./out/indexing/${normalizeChainName(chain)}`
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true })
  }

  const baseURL = `${opts.baseUrl.replace('/$', '')}/indexing/${normalizeChainName(chain)}`

  await fetchFile(baseURL, 'index.db', outDir, true)
  if (!fs.existsSync(`${outDir}/index.db`) && !opts.allowStartFromScratch) {
    throw new Error('Failed to download index.db (if starting from scratch, pass --allow-start-from-scratch)')
  }

  await fetchFile(baseURL, 'index.json', outDir, true)
  const oldIndexJson = (() => {
    try {
      return JSON.parse(fs.readFileSync(`${outDir}/index.json`, 'utf-8'))
    } catch (e) {
      console.error(`Failed to parse old index.json for "${chain}"`, e)
      return []
    }
  })()

  const checkpointsFetch = []
  for (const checkpoint of oldIndexJson) {
    checkpointsFetch.push(fetchFile(baseURL, `${checkpoint.hash}.json`, outDir, false))
  }
  await Promise.all(checkpointsFetch)

  await invokeProcess('node', ['indexer.js', '-c', chain, outDir], 2 * 60 * 60, 'SIGUSR1')

  // re-read index.json
  const newIndexJson = (() => {
    try {
      return JSON.parse(fs.readFileSync(`${outDir}/index.json`, 'utf-8'))
    } catch (e) {
      console.error(`Failed to parse new index.json for "${chain}"`, e)
      return []
    }
  })()

  // compress all checkpoint files
  const compressions = []
  for (const checkpoint of newIndexJson) {
    const fpath = `${outDir}/${checkpoint.hash}.json`
    const compressedFpath = `${fpath}.gz`
    if (!fs.existsSync(compressedFpath)) {
      compressions.push(invokeProcess('gzip', ['-vf', fpath]))
    }
  }

  // compress index.json
  compressions.push(invokeProcess('gzip', ['-vf', `${outDir}/index.json`]))
  // compress index.db
  compressions.push(invokeProcess('gzip', ['-vf', `${outDir}/index.db`]))

  await Promise.all(compressions)

  // cleanup old uncompressed checkpoint files
  await invokeProcess('find', [outDir, '-type', 'f', '-name', '*.json', '-delete'])
}

async function run() {
  const promises = []

  for (const key of Object.keys(DEPLOYMENT)) {
    if (key !== 'Hardhat') {
      promises.push(indexChain(key as Chain))
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
