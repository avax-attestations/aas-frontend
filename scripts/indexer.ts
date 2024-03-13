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

const db = new sqlite3(`${args[0]}/index.db`, {
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
const getLastBlockStmt = db.prepare("SELECT value FROM properties WHERE key = 'lastBlock'")
const updateLastBlockStmt = db.prepare("REPLACE INTO properties (key, value) VALUES ('lastBlock', ?)")
const queryMutations = db.prepare("SELECT * FROM mutations WHERE id > ? ORDER BY id LIMIT 1000")

async function getLastBlock() {
  const row = getLastBlockStmt.get()
  if (!row) {
    return 0n
  }
  return BigInt((row as any).value)
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
    const [fetched, currentBlock, mutations] = await computeMutations(chainName, client, eas, {
      getSchema,
      getLastBlock
    })

    if (!fetched) {
      break
    }

    db.transaction((currentBlock, mutations) => {
      updateLastBlockStmt.run(currentBlock.toString())
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
    })(currentBlock, mutations);
  }
}

index().then(() => {
  console.log('Indexing finished')
  process.exit(0)
}).catch((err) => {
  console.error('Indexing failed', err)
  process.exit(1)
});
