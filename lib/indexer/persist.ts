import { type Chain } from '@/lib/config';
import { Mutations, computeMutations } from '@/lib/indexer/query';
import { Database } from '@/lib/db';
import { type PublicClient } from 'viem';
import { type EAS } from '@ethereum-attestation-service/eas-sdk';


export async function index(chain: Chain, client: PublicClient, eas: EAS, db: Database) {
  while (true) {
    const [fetched, currentBlock, mutations] = await computeMutations(chain, client, eas, {
      getSchema: async (uid) => {
        const items = await db.schemas.where('uid').equals(uid).toArray()
        if (items.length !== 1) {
          throw new Error(`Cannot find schema with uid ${uid}`)
        }
        return items[0]
      },
      getLastBlock: async () => {
        const result = await db.properties.get('lastBlock')
        if (!result) {
          return 0n
        }
        return BigInt(result.value)
      }
    })

    if (!fetched) {
      break
    }

    await db.transaction('rw', db.properties, db.schemas, db.attestations, async () => {
      await persist(db, mutations, currentBlock)
      await db.properties.put({ key: 'lastBlock', value: currentBlock.toString() });
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
  const lastBlock = parseInt(((await db.properties.get('lastBlock')) ?? { value: '0' }).value)
  await db.transaction('rw', db.properties, db.schemas, db.attestations, async () => {
    for (const checkpoint of data) {
      if (checkpoint.max >= lastBlock && checkpoint.hash !== lastCheckpoint) {
        await processCheckpoint(db, checkpoint, baseURL)
        await db.properties.put({ key: 'lastCheckpoint', value: checkpoint.hash });
      }
    }
    const checkpointsLatestBlock = data[data.length - 1]?.max
    if (lastBlock !== checkpointsLatestBlock) {
      console.log('Updating latest block to', checkpointsLatestBlock)
      await db.properties.put({ key: 'lastBlock', value: checkpointsLatestBlock.toString() });
    }
  })
}

async function processCheckpoint(db: Database, checkpoint: any, baseURL: string) {
  console.log(`Processing checkpoint ${checkpoint.hash}...`)
  const response = await fetch(`${baseURL}/${checkpoint.hash}.json`)
  if (response.status >= 400) {
    console.error(`Failed to fetch checkpoint ${checkpoint.hash}`)
    return
  }
  const data = await response.json()
  const currentBlock = BigInt(checkpoint.max)
  await persist(db, data, currentBlock)
}

export async function persist(db: Database, mutations: Mutations, currentBlock: bigint) {
  if (mutations.length) {
    console.log(`Processing ${mutations.length} mutations`)
  }
  for (const mut of mutations) {
    if (mut.blockNumber > currentBlock) {
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
