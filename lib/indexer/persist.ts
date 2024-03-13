import { type Chain } from '@/lib/config';
import { Mutations, computeMutations } from '@/lib/indexer/query';
import { Database } from '@/lib/db';
import { type PublicClient } from 'viem';
import { type SchemaRegistry, type EAS } from '@ethereum-attestation-service/eas-sdk';


export async function index(
  chain: Chain,
  client: PublicClient,
  db: Database
) {
  while (true) {
    const [fetched, nextBlock, mutations] = await computeMutations(chain, client, {
      getSchema: async (uid) => {
        const items = await db.schemas.where('uid').equals(uid).toArray()
        if (items.length !== 1) {
          throw new Error(`Cannot find schema with uid ${uid}`)
        }
        return items[0]
      },
      getNextBlock: async () => {
        const result = await db.properties.get('nextBlock')
        if (!result) {
          return 0
        }
        return Number(result.value)
      }
    })

    if (!fetched) {
      break
    }

    await db.transaction('rw', db.properties, db.schemas, db.attestations, async () => {
      await persist(db, mutations, nextBlock)
      await db.properties.put({ key: 'nextBlock', value: nextBlock });
    })
  }
}

function getIndexingURL(chain: Chain, basePath: string) {
  return `${basePath}/indexing/${chain.toLowerCase().replace(' ', '-').replace(/\/$/, '')}`
}

export async function resume(chain: Chain, db: Database, basePath: string) {
  const baseURL = getIndexingURL(chain, basePath)
  const response = await fetch(`${baseURL}/index.json`, { cache: 'no-store' })
  if (response.status >= 400) {
    return
  }
  const data = await response.json()

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
  const response = await fetch(`${baseURL}/${checkpoint.hash}.json`)
  if (response.status >= 400) {
    console.error(`Failed to fetch checkpoint ${checkpoint.hash}`)
    return
  }
  const data = await response.json()
  await db.transaction('rw', db.properties, db.schemas, db.attestations, async () => {
    await persist(db, data, nextBlock)
    console.log('Updating latest block to', checkpoint.max)
    console.log('Updating checkpoint to', checkpoint.hash)
    await db.properties.put({ key: 'lastCheckpoint', value: checkpoint.hash });
    await db.properties.put({ key: 'nextBlock', value: checkpoint.max + 1 });
  })
}

export async function persist(db: Database, mutations: Mutations, nextBlock: number) {
  if (mutations.length) {
    console.log(`Processing ${mutations.length} mutations`)
  }
  for (const mut of mutations) {
    if (mut.blockNumber < nextBlock) {
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
  }
}
