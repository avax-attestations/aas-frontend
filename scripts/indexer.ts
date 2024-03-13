import crypto from 'crypto'
import fs from 'fs'
import { createPublicClient, http } from 'viem';
import sqlite3 from 'better-sqlite3'
import { program, Option } from 'commander'
import { EAS, type TransactionSigner } from "@ethereum-attestation-service/eas-sdk"
import { DEPLOYMENT } from "@/lib/config";
import { computeMutations } from '@/lib/indexer/query';
import { publicClientToProvider } from '@/hooks/useProvider';

program
  .addOption(new Option('-c, --chain <chain>', 'Chain to index')
    .choices(Object.keys(DEPLOYMENT)).makeOptionMandatory(true))
  .argument('<storage-dir>', 'Directory to indexing cache')

const parsed = program.parse(process.argv)
const opts = parsed.opts()
const args = parsed.args

const storageDir = args[0]

const db = new sqlite3(`${storageDir}/index.db`, {
  nativeBinding: './node_modules/better-sqlite3/build/Release/better_sqlite3.node'
})
db.exec(`
CREATE TABLE IF NOT EXISTS properties (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mutations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block INTEGER NOT NULL,
  table_name TEXT NOT NULL,
  operation TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schemas (
  uid TEXT PRIMARY KEY,
  data TEXT NOT NULL
);`)

const insertMutationStmt = db.prepare("INSERT INTO mutations (block, table_name, operation, data) VALUES (?, ?, ?, ?)")
const getSchemaStmt = db.prepare("SELECT data FROM schemas WHERE uid = ?")
const updateSchemaStmt = db.prepare("REPLACE INTO schemas (uid, data) VALUES (?, ?)")
const getNextBlockStmt = db.prepare("SELECT value FROM properties WHERE key = 'nextBlock'")
const updateNextBlockStmt = db.prepare("REPLACE INTO properties (key, value) VALUES ('nextBlock', ?)")
const queryMutations = db.prepare("SELECT * FROM mutations WHERE id > ? ORDER BY id LIMIT 1000")

async function getNextBlock() {
  const row = getNextBlockStmt.get()
  if (!row) {
    return 0
  }
  return (row as any).value
}

async function getSchema(uid: string) {
  const row = getSchemaStmt.get(uid)
  if (!row) {
    throw new Error(`Cannot find schema with uid ${uid}`)
  }
  return JSON.parse((row as any).data)
}

async function index() {
  const [deployment, chainName] = (() => {
    const value = DEPLOYMENT[opts.chain as keyof typeof DEPLOYMENT]
    if (!value) {
      throw new Error(`Unknown chain ${opts.chain}`)
    }
    return [value, opts.chain as keyof typeof DEPLOYMENT]
  })();

  const client = createPublicClient({
    chain: deployment.chain,
    transport: http()
  })

  const provider = publicClientToProvider(client) as unknown as TransactionSigner;
  const eas = new EAS(deployment.eas.address)
  eas.connect(provider)

  while (true) {
    const [fetched, nextBlock, mutations] = await computeMutations(chainName, client, eas, {
      getSchema,
      getNextBlock
    })

    if (!fetched) {
      break
    }

    db.transaction((nextBlock, mutations) => {
      updateNextBlockStmt.run(nextBlock)
      for (const mut of mutations) {
        insertMutationStmt.run(mut.blockNumber, mut.table, mut.operation, JSON.stringify(mut.data))
      }
      for (const mut of mutations) {
        if (mut.table !== 'schemas') {
          continue
        }
        if (mut.operation !== 'put' && mut.operation !== 'modify') {
          throw new Error(`Invalid operation "${mut.operation}" for table "schemas"`)
        }
        const row = getSchemaStmt.get(mut.data.uid)
        const modified = (() => {
          if (!row) {
            return mut.data
          }
          return {
            ...JSON.parse((row as any).data),
            ...mut.data
          }
        })()
        updateSchemaStmt.run(mut.data.uid, JSON.stringify(modified))
      }
    })(nextBlock, mutations);
  }

  // Fetch mutations from db in batches and write to stdout
  let lastId = 0;
  const index = []
  while (true) {
    const rows = queryMutations.all(lastId)
    if (rows.length === 0) {
      break
    }
    const batch = []
    for (const row of rows) {
      batch.push({
        operation: (row as any).operation,
        table: (row as any).table_name,
        blockNumber: Number((row as any).block),
        data: JSON.parse((row as any).data)
      })
      lastId = (row as any).id
    }
    const batchJson = JSON.stringify(batch)
    // compute sha256 hash of batchJson and write it to a file named after the hash
    const hash = crypto.createHash('sha256').update(batchJson).digest('hex')
    const fname = `${storageDir}/${hash}.json`
    console.log('writing', fname)
    fs.writeFileSync(fname, batchJson)

    const min = Number((rows[0] as any).block)
    const max = Number((rows[rows.length - 1] as any).block)
    index.push({ min, max, hash })
  }

  index[index.length - 1].max = Number(await getNextBlock()) - 1
  const fname = `${storageDir}/index.json`
  console.log('writing', fname)
  fs.writeFileSync(fname, JSON.stringify(index))
}

index().then(() => {
  console.log('Indexing finished')
  process.exit(0)
}).catch((err) => {
  console.error('Indexing failed', err)
  process.exit(1)
});
