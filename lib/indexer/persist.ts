import { type Chain } from '@/lib/config';
import { sleep } from '@/lib/utils';
import { computeMutations } from '@/lib/indexer/query';
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
      await db.properties.put({ key: 'lastBlock', value: currentBlock.toString() });

      for (const mut of mutations) {
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
    })
  }
}
