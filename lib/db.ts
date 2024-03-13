import Dexie, { Table } from 'dexie';
import { type Chain } from '@/lib/config';

interface Property {
  key: string
  value: any
}

export interface Schema {
  id?: number
  uid: string
  schema: string
  creator: string
  resolver: string
  time: number
  txid: string
  revocable: boolean
  name: string
  attestationCount: number
}

export interface Attestation {
  id?: number
  uid: string
  schemaId: string
  data: string
  attester: string
  recipient: string
  refUID: string
  revocationTime: number
  expirationTime: number
  time: number
  txid: string
  revoked: boolean
  timeCreated: number
  revocable: boolean
  decodedDataJson: string
}

export interface Timestamp {
  uid: string
  timestamp: number
  from: string
  txid: string
}

const DB_VERSION = 5;

class AASDexie extends Dexie {

  properties!: Table<Property>
  schemas!: Table<Schema>
  attestations!: Table<Attestation>
  timestamps!: Table<Timestamp>

  constructor(chain: Chain) {
    super(`aas-${chain}`)

    this.version(DB_VERSION).stores({
      properties: '&key',
      schemas: '++id, &uid, schema, resolver, creator, time, name',
      attestations: '++id, &uid, schemaId, attester, recipient, time',
      timestamps: '++id, &uid, timestamp, from',
    });
  }

  public open() {
    if (this.isOpen()) return super.open();

    return Dexie.Promise.resolve()
      .then(() => Dexie.exists(this.name))
      .then((exists) => {
        if (!exists) {
          // no need to check database version since it doesn't exist
          return;
        }

        // Open separate instance of dexie to get current database version
        return new Dexie(this.name).open()
          .then(async db => {
            if (db.verno >= DB_VERSION) {
              // database up to date (or newer)
              return db.close();
            }

            console.log(`Database schema out of date, resetting all data. (currentVersion: ${db.verno}, expectedVersion: ${DB_VERSION})`);
            await db.delete();

            // ensure the delete was successful
            const exists = await Dexie.exists(this.name);
            if (exists) {
              throw new Error('Failed to remove mock backend database.');
            }
          })
      })
      .then(() => super.open());
  }
}

export type TableName = Exclude<{
  [K in keyof Database]: Database[K] extends Table<any> ? K : never
}[keyof Database], 'properties'>;

export type EntityFromTableName<T extends TableName> = Database[T] extends Table<infer U> ? U : never;

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
