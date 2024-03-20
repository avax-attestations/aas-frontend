import type { TableName, Schema, EntityFromTableName } from '@/lib/db'
import { PublicClient, decodeEventLog, getContract, zeroHash } from 'viem';
import { DEPLOYMENT, type Chain } from '@/lib/config';
import { Abi, AbiEvent } from 'abitype';
import { SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import { blockQueryRange, min, sleep } from '@/lib/utils';

function getEventFromAbi(abi: Abi, eventName: string) {
  const event = abi.find(
    item => item.type === "event" && item.name === eventName);

  if (!event) {
    throw new Error(`Cannot find event "${eventName}" in abi`);
  }

  return event as AbiEvent;
}

// Fetch events in a block range, retrying with half the range on failure
// until the range is 1 block. If it fails with a range of 1 block,
// the exception will be propagated.
async function getEventsInBlockRangeRetry(
  chain: Chain,
  client: PublicClient,
  contractAddress: `0x${string}`,
  abi: Abi,
  events: AbiEvent[],
  fromBlock: bigint,
  toBlock: bigint
) {
  const gen = blockQueryRange(fromBlock, toBlock)
  const result = []
  let prevRangeResult = false
  let remainingTries = 10;

  while (true) {
    const next = gen.next(prevRangeResult)
    if (next.done) {
      return result
    }

    const [from, to] = next.value
    try {
      result.push(...(await getEventsInBlockRange(client, contractAddress, abi, events, from, to)))
      prevRangeResult = true
      remainingTries = 10
    } catch (err) {
      prevRangeResult = false
      if (from === to) {
        console.error(`${new Date().toISOString()} - ${chain} - Error fetching events between blocks ${from} and ${to}, will retry ${remainingTries} more times`);
        remainingTries--
        if (remainingTries === 0) {
          throw err
        }
        await sleep(5000)
      } else {
        console.error(`${new Date().toISOString()} - ${chain} - Error fetching events between blocks ${from} and ${to}, will retry a lower range`);
        await sleep(5000)
      }
    }
  }
}
async function getEventsInBlockRange(
  client: PublicClient,
  contractAddress: `0x${string}`,
  abi: Abi,
  events: AbiEvent[],
  fromBlock: bigint,
  toBlock: bigint
) {
  return Promise.all((await client.getLogs({
    address: contractAddress,
    events: events,
    fromBlock: fromBlock,
    toBlock: toBlock,
  })).map(async (log) => {
    const block = await client.getBlock({
      blockHash: log.blockHash
    })
    const transaction = await client.getTransaction({
      hash: log.transactionHash
    })
    const decodedEvent = decodeEventLog({
      abi: abi,
      ...log
    })
    return {
      log: log,
      decodedEvent,
      transaction,
      block
    }
  }));
}

type Event = Awaited<ReturnType<typeof getEventsInBlockRange>>[0]

export const schemaNameUID =
  "0x44d562ac1d7cd77e232978687fea027ace48f719cf1d58c7888e509663bb87fc";


export async function computeMutations(
  chain: Chain,
  client: PublicClient,
  nextBlock: number,
  db: Database
): Promise<[true, number, Mutations] | [false]> {
  const schemaRegistryAbi = DEPLOYMENT[chain].schemaRegistry.abi;
  const schemaRegistryAddress = DEPLOYMENT[chain].schemaRegistry.address;
  const easAbi = DEPLOYMENT[chain].eas.abi;
  const easAddress = DEPLOYMENT[chain].eas.address;
  const blockBatchSize = DEPLOYMENT[chain].blockBatchSize - 1n;


  const schemaRegisteredEvent = getEventFromAbi(schemaRegistryAbi, "Registered");
  const attestedEvent = getEventFromAbi(easAbi, "Attested");
  const revokedEvent = getEventFromAbi(easAbi, "Revoked");
  const revokedOffchainEvent = getEventFromAbi(easAbi, "RevokedOffchain");
  const timestampedEvent = getEventFromAbi(easAbi, "Timestamped");

  const schemaRegistryEvents = [schemaRegisteredEvent]
  const easEvents = [attestedEvent, revokedEvent, revokedOffchainEvent, timestampedEvent]

  const fromBlock = await (async () => {
    const result = nextBlock
    if (!result) {
      const hash = DEPLOYMENT[chain].schemaRegistry.deploymentTxn
      if (hash === '0x0') {
        return 0n;
      }
      const txn = await client.getTransaction({ hash });
      return txn.blockNumber;
    }
    return BigInt(result)
  })();

  let currentBlock = fromBlock;
  const block = await client.getBlock({ blockTag: 'latest' });
  const latestBlock = block.number;

  if (currentBlock > latestBlock) {
    return [false]
  }

  const toBlock = min(currentBlock + blockBatchSize, latestBlock);

  // schemas
  const decodedSchemaRegistryEvents = await getEventsInBlockRangeRetry(
    chain,
    client,
    schemaRegistryAddress,
    schemaRegistryAbi,
    schemaRegistryEvents,
    currentBlock,
    toBlock
  )

  const decodedEasEvents = await getEventsInBlockRangeRetry(
    chain,
    client,
    easAddress,
    easAbi,
    easEvents,
    currentBlock,
    toBlock
  )

  const allEvents = decodedSchemaRegistryEvents.concat(decodedEasEvents)
  console.log(`${new Date().toISOString()} - ${chain} - Fetched ${allEvents.length} events between blocks ${fromBlock} and ${toBlock}`);

  currentBlock = toBlock + 1n;

  const mutations = [] as Mutations
  const schemaCache = {} as Record<string, Schema>
  for (const event of allEvents) {
    switch (event.decodedEvent.eventName) {
      case 'Registered':
        mutations.push(...(await handleSchemaRegisteredEvent(event, client, schemaCache)))
        break;
      case 'Attested':
        mutations.push(...(await handleAttestedEvent(event, client, db, schemaCache)))
        break;
      case 'Revoked':
        mutations.push(...(await handleRevokedEvent(event, client)))
        break;
      // case 'RevokedOffchain':
      //   mutations.push(...(await handleRevokedOffchainEvent(event)))
      //   break;
      case 'Timestamped':
        mutations.push(...(await handleTimestampedEvent(event)))
        break;
      default:
        console.warn(`Unhandled event ${event.decodedEvent.eventName}`)
        break;
    }
  }

  console.log(`${new Date().toISOString()} - ${chain} - Created ${mutations.length} mutations between ${fromBlock} and ${toBlock}`);

  return [true, Number(currentBlock), mutations]
}

type PutMutation<T extends TableName> = {
  operation: 'put'
  table: T
  data: EntityFromTableName<T>
  blockNumber: number
}

type ModifyMutation<T extends TableName> = {
  operation: 'modify'
  table: T
  data: Partial<EntityFromTableName<T>>
  blockNumber: number
}

type Mutation<T extends TableName> = PutMutation<T> | ModifyMutation<T>

export type Mutations = Mutation<TableName>[]

type SchemaRecord = {
  uid: string
  resolver: string
  revocable: boolean
  schema: string
}

async function handleSchemaRegisteredEvent(event: Event, client: PublicClient, schemaCache: Record<string, Schema>): Promise<Mutations> {
  const args = event.decodedEvent.args as any;

  const schemaRecord = await getSchema(client, args.uid)

  const schema = {
    uid: schemaRecord.uid,
    schema: schemaRecord.schema,
    creator: event.transaction.from,
    resolver: schemaRecord.resolver,
    time: timeToNumber(event.block.timestamp),
    txid: event.transaction.hash,
    revocable: schemaRecord.revocable,
    name: '',
    attestationCount: 0
  }
  schemaCache[schema.uid] = schema
  return [{
    operation: 'put',
    table: 'schemas',
    data: schema,
    blockNumber: Number(event.block.number)
  }]
}

function timeToNumber(timestamp: bigint) {
  return Number(timestamp)
}

interface Database {
  getSchema: (uid: string) => Promise<Schema | null>
}

interface AttestationRecord {
  uid: string
  schema: string
  time: bigint
  expirationTime: bigint
  revocationTime: bigint
  refUID: string
  recipient: string
  attester: string
  revocable: boolean
  data: string
}

async function getSchema(client: PublicClient, uid: string): Promise<SchemaRecord> {
  if (!client.chain) {
    throw new Error('invalid chain')
  }
  const chain = client.chain.name as Chain;

  const schemaContract = getContract({
    address: DEPLOYMENT[chain].schemaRegistry.address,
    abi: DEPLOYMENT[chain].schemaRegistry.abi,
    client
  })

  let remainingTries = 10;
  while (true) {
    try {
      const schemaRecord = await schemaContract.read.getSchema([uid]) as SchemaRecord
      if (schemaRecord.uid !== zeroHash) {
        return schemaRecord
      }
      await sleep(1000)
    } catch (err) {
      remainingTries--
      console.error(`${new Date().toISOString()} - ${chain} - Error fetching schema ${uid}, will retry ${remainingTries} more times`);
      if (remainingTries === 0) {
        throw err
      }
      await sleep(5000)
    }
  }
}

async function getAttestation(client: PublicClient, uid: string): Promise<AttestationRecord> {
  if (!client.chain) {
    throw new Error('invalid chain')
  }
  const chain = client.chain.name as Chain;

  const eas = getContract({
    address: DEPLOYMENT[chain].eas.address,
    abi: DEPLOYMENT[chain].eas.abi,
    client
  })

  let remainingTries = 10;
  while (true) {
    try {
      const attestationRecord = await eas.read.getAttestation([uid]) as AttestationRecord
      if (attestationRecord.uid !== zeroHash) {
        return attestationRecord
      }
      await sleep(1000)
    } catch (err) {
      remainingTries--
      console.error(`${new Date().toISOString()} - ${chain} - Error fetching attestation ${uid}, will retry ${remainingTries} more times`);
      if (remainingTries === 0) {
        throw err
      }
      await sleep(5000)
    }
  }
}

async function handleAttestedEvent(event: Event, client: PublicClient, db: Database, schemaCache: Record<string, Schema>): Promise<Mutations> {
  const args = event.decodedEvent.args as any
  const attestation = await getAttestation(client, args.uid)

  const schema = await (async () => {
    if (schemaCache[attestation.schema]) {
      // schema registered in the same block batch which is not committed to the db yet
      // get from cache
      return schemaCache[attestation.schema]
    }
    return db.getSchema(attestation.schema)
  })()
  if (!schema) {
    // attestation withou a matching schema, ignore
    return []
  }
  schema.attestationCount++;

  let decodedData: any = null
  let decodedDataJson = ''

  try {
    const encoder = new SchemaEncoder(schema.schema)
    // The decoded data can contain bigint values, so we have to use the "replacer" argument
    // to serialize bigints as strings.
    decodedData = encoder.decodeData(attestation.data)
    decodedDataJson = JSON.stringify(decodedData, (_, value) =>
      typeof value === "bigint" ? value.toString() : value)
  } catch (err) {
    console.warn(`Error decoding data for attestation ${attestation.uid}`, err)
  }

  const timeCreated = Math.round(new Date().valueOf() / 1000)

  const result = [{
    operation: 'put',
    table: 'attestations',
    data: {
      uid: attestation.uid,
      schemaId: attestation.schema,
      data: attestation.data,
      attester: attestation.attester,
      recipient: attestation.recipient,
      refUID: attestation.refUID,
      revocationTime: timeToNumber(attestation.revocationTime),
      expirationTime: timeToNumber(attestation.expirationTime),
      time: timeToNumber(attestation.time),
      txid: event.transaction.hash,
      revoked: attestation.revocationTime < BigInt(timeCreated) && attestation.revocationTime !== 0n,
      timeCreated,
      revocable: attestation.revocable,
      decodedDataJson
    },
    blockNumber: Number(event.block.number)
  }, {
    operation: 'modify',
    table: 'schemas',
    data: {
      uid: schema.uid,
      attestationCount: schema.attestationCount
    },
    blockNumber: Number(event.block.number)
  }] as Mutations


  if (attestation.schema === schemaNameUID) {
    const uid = decodedData[0].value.value
    const name = decodedData[1].value.value
    const schemaBeingNamed = await (async () => {
      if (schemaCache[uid]) {
        // schema being named in the same block batch which is not committed to the db yet.
        // get from cache
        return schemaCache[uid]
      }
      return db.getSchema(uid)
    })()

    if (schemaBeingNamed?.creator.toLowerCase() === attestation.attester.toLowerCase()) {
      result.push({
        operation: 'modify',
        table: 'schemas',
        data: {
          uid,
          name
        },
        blockNumber: Number(event.block.number)
      })
    }
  }

  return result
}

async function handleRevokedEvent(event: Event, client: PublicClient): Promise<Mutations> {
  const args = event.decodedEvent.args as any
  const attestation = await getAttestation(client, args.uid)

  const result = [{
    operation: 'modify',
    table: 'attestations',
    data: {
      uid: attestation.uid,
      revoked: true,
      revocationTime: timeToNumber(attestation.revocationTime)
    },
    blockNumber: Number(event.block.number)
  }] as Mutations;

  return result
}

async function handleTimestampedEvent(event: Event): Promise<Mutations> {
  const uid = event.log.topics[1]
  const timestamp = event.log.topics[2] ? BigInt(event.log.topics[2]) : 0n

  return [{
    operation: 'put',
    table: 'timestamps',
    data: {
      uid: uid ?? '',
      timestamp: timeToNumber(timestamp),
      from: event.transaction.from,
      txid: event.transaction.hash
    },
    blockNumber: Number(event.block.number)
  }]
}
