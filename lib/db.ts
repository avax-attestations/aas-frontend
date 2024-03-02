import Dexie, { Table } from 'dexie';
import { type Chain } from '@/lib/config';

interface Property {
  key: string
  value: string
}

interface Schema {
  id?: number
  uid: string
  schema: string
  creator: string
  resolver: string
  time: string
  txid: string
  revocable: boolean
}

class AASDexie extends Dexie {
  properties!: Table<Property>
  schemas!: Table<Schema>

  constructor(chain: Chain) {
    super(`aas-${chain}`)

    this.version(1).stores({
      properties: '&key',
      schemas: '++id, &uid, schema, resolver, creator, time',
    });
  }
}

export type Database = AASDexie;
const dbCache = new Map<Chain, AASDexie>();

export function getDb(chain: Chain): AASDexie {
  let result = dbCache.get(chain)
  if (!result) {
    result = new AASDexie(chain);
    dbCache.set(chain, result)
  }
  return result;
}
