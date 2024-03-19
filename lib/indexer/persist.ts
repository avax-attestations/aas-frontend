import { DEPLOYMENT, type Chain } from '@/lib/config';
import { Mutations, computeMutations } from '@/lib/indexer/query';
import { Database } from '@/lib/db';
import pako from 'pako'
import { type PublicClient } from 'viem';
import { normalizeChainName, sleep } from '@/lib/utils';

export async function index(
  chain: Chain,
  client: PublicClient,
  db: Database,
  signal: { shouldStop: boolean }
) {
  const delay = DEPLOYMENT[chain].delayBetweenRPCRequests

  while (!signal.shouldStop) {
    const [fetched, nextBlock, mutations] = await computeMutations(
      chain, client, (await db.properties.get('nextBlock'))?.value ?? 0, {
      getSchema: async (uid) => {
        const items = await db.schemas.where('uid').equals(uid).toArray()
        if (items.length !== 1) {
          return null
        }
        return items[0]
      }
    })

    if (!fetched) {
      break
    }

    const currentBlock = (await db.properties.get('nextBlock'))?.value ?? 0
    await db.transaction('rw', db.properties, db.schemas, db.attestations, db.timestamps, async () => {
      await persist(db, mutations, currentBlock)
      await db.properties.put({ key: 'nextBlock', value: nextBlock });
    })

    if (delay) {
      await sleep(delay)
    }
  }
}

function getIndexingURL(chain: Chain, basePath: string) {
  return `${basePath}/indexing/${normalizeChainName(chain)}`
}

async function fetchJsonGzip(url: string, requestInit?: RequestInit) {
  const response = await fetch(`${url}.gz`, requestInit)
  if (!response.ok) {
    return null
  }
  const ab = await response.arrayBuffer()
  const data = pako.inflate(new Uint8Array(ab), { to: 'string' })
  return JSON.parse(data)
}

async function fetchJson(url: string, requestInit?: RequestInit) {
  const inflated = await fetchJsonGzip(url, requestInit)
  if (inflated) {
    return inflated
  }
  // If the .gz file does not exist, try the uncompressed version
  const response = await fetch(url, requestInit)
  if (!response.ok) {
    console.warn(`Failed to fetch ${url}: ${response.statusText}`)
  }
  const data = await response.json()
  return data
}

export async function resume(chain: Chain, db: Database, basePath: string) {
  const baseURL = getIndexingURL(chain, basePath)
  const data = await fetchJson(`${baseURL}/index.json`, { cache: 'no-store' })

  const lastCheckpoint = ((await db.properties.get('lastCheckpoint')) ?? { value: '' }).value
  const nextBlock = ((await db.properties.get('nextBlock')) ?? { value: 0 }).value
  for (const checkpoint of data) {
    if (checkpoint.max >= nextBlock && checkpoint.hash !== lastCheckpoint) {
      await processCheckpoint(db, checkpoint, baseURL, nextBlock)
    }
  }
}

async function processCheckpoint(db: Database, checkpoint: any, baseURL: string, nextBlock: number) {
  console.log(`Processing checkpoint ${checkpoint.hash}...`)
  const data = await fetchJson(`${baseURL}/${checkpoint.hash}.json`)
  await db.transaction('rw', db.properties, db.schemas, db.attestations, db.timestamps, async () => {
    await persist(db, data, nextBlock)
    console.log('Updating latest block to', checkpoint.max)
    console.log('Updating checkpoint to', checkpoint.hash)
    await db.properties.put({ key: 'lastCheckpoint', value: checkpoint.hash });
    await db.properties.put({ key: 'nextBlock', value: checkpoint.max + 1 });
  })
}

export async function persist(db: Database, mutations: Mutations, nextBlock: number) {
  let processed = 0
  for (const mut of mutations) {
    if (mut.blockNumber < nextBlock) {
      // ignore mutations from blocks that have already been processed
      continue
    }
    const op = mut.operation
    switch (op) {
      case 'put':
        // It seems typescript cannot infer that the operation below is safe
        // so we have to cast to unknown/any
        await db[mut.table].put(mut.data as unknown as any)
        break;
      case 'modify':
        if (mut.data.uid) {
          await db[mut.table].where('uid').equals(mut.data.uid).modify(mut.data)
        } else {
          console.warn('Modify operation missing uid')
        }
        break;
      default:
        console.warn(`Invalid mutation "${op}"`)
        break;
    }
    processed++
  }

  if (processed > 0) {
    console.log(`Processed ${processed} new mutations`)
  }
}
