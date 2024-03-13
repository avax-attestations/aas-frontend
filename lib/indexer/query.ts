import type { TableName, Schema, EntityFromTableName } from '@/lib/db'
import { PublicClient, decodeEventLog, getContract, zeroHash } from 'viem';
import { DEPLOYMENT, type Chain } from '@/lib/config';
import { Abi, AbiEvent } from 'abitype';
import {
  EAS,
  SchemaEncoder,
  type Attestation as EASAttestation,
  TransactionSigner
} from '@ethereum-attestation-service/eas-sdk';
import { sleep } from '@/lib/utils';

function min(a: bigint, b: bigint) {
  return a < b ? a : b;
}

function getEventFromAbi(abi: Abi, eventName: string) {
  const event = abi.find(
    item => item.type === "event" && item.name === eventName);

  if (!event) {
    throw new Error(`Cannot find event "${eventName}" in abi`);
  }

  return event as AbiEvent;
}

async function getEventsInBlockRangeRetry(
  client: PublicClient,
  contractAddress: `0x${string}`,
  abi: Abi,
  events: AbiEvent[],
  fromBlock: bigint,
  toBlock: bigint
) {
  let tries = 1;
  while (true) {
    try {
      return await getEventsInBlockRange(client, contractAddress, abi, events, fromBlock, toBlock)
    } catch (err) {
      await sleep(1000)
      tries++
      if (tries > 10) {
        console.error('failed to get events in block range', fromBlock, toBlock, err)
        throw err
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
    const result = await db.getNextBlock();
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
  if (toBlock - currentBlock > 1n) {
    console.log(`${new Date().toISOString()} - ${chain} - Fetching events from block ${currentBlock} to ${toBlock}`);
  }

  // schemas
  const decodedSchemaRegistryEvents = await getEventsInBlockRangeRetry(
    client,
    schemaRegistryAddress,
    schemaRegistryAbi,
    schemaRegistryEvents,
    currentBlock,
    toBlock
  )

  const decodedEasEvents = await getEventsInBlockRangeRetry(
    client,
    easAddress,
    easAbi,
    easEvents,
    currentBlock,
    toBlock
  )

  const allEvents = decodedSchemaRegistryEvents.concat(decodedEasEvents)

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
        console.warn(`Unexpected event ${event.decodedEvent.eventName}`)
        break;
    }
  }

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
  if (!client.chain) {
    throw new Error('invalid chain')
  }
  const chain = client.chain.name as Chain;

  const schemaContract = getContract({
    address: DEPLOYMENT[chain].schemaRegistry.address,
    abi: DEPLOYMENT[chain].schemaRegistry.abi,
    client
  })
  const args = event.decodedEvent.args as any;

  const schemaRecord = await (async () => {
    let tries = 1;

    while (true) {
      const schemaRecord = await schemaContract.read.getSchema([args.uid]) as SchemaRecord
      if (schemaRecord.uid !== zeroHash) {
        return schemaRecord
      }
      console.log(`Delaying schema poll after try #${tries++}...`);
      await sleep(500)
    }
  })()

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
  getSchema: (uid: string) => Promise<Schema>
  getNextBlock: () => Promise<number>
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

async function handleAttestedEvent(event: Event, client: PublicClient, db: Database, schemaCache: Record<string, Schema>): Promise<Mutations> {

  if (!client.chain) {
    throw new Error('invalid chain')
  }
  const chain = client.chain.name as Chain;

  const eas = getContract({
    address: DEPLOYMENT[chain].eas.address,
    abi: DEPLOYMENT[chain].eas.abi,
    client
  })
  const args = event.decodedEvent.args as any
  let attestation: AttestationRecord


  let tries = 1;
  while (true) {
    const result = await eas.read.getAttestation([args.uid]) as AttestationRecord

    if (result.uid !== zeroHash) {
      attestation = result;
      break;
    }

    console.log(`Could not find attestation with uid "${args.uid}", retry #${tries} after 500 milliseconds...`)
    await sleep(500)
    tries++
  }

  const schema = await (async () => {
    if (schemaCache[attestation.schema]) {
      // schema registered in the same block batch which is not committed to the db yet
      // get from cache
      return schemaCache[attestation.schema]
    }
    return db.getSchema(attestation.schema)
  })()
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

    if (schemaBeingNamed.creator.toLowerCase() === attestation.attester.toLowerCase()) {
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
  if (!client.chain) {
    throw new Error('invalid chain')
  }
  const chain = client.chain.name as Chain;

  const eas = getContract({
    address: DEPLOYMENT[chain].eas.address,
    abi: DEPLOYMENT[chain].eas.abi,
    client
  })
  const args = event.decodedEvent.args as any
  let attestation: AttestationRecord


  let tries = 1;
  while (true) {
    const result = await eas.read.getAttestation([args.uid]) as AttestationRecord

    if (result.uid !== zeroHash) {
      attestation = result;
      break;
    }

    console.log(`Could not find attestation with uid "${args.uid}", retry #${tries} after 500 milliseconds...`)
    await sleep(500)
    tries++
  }

  const result = [{
    operation: 'modify',
    table: 'attestations',
    data: {
      uid: attestation.uid,
      revoked: true,
      revocationTime: timeToNumber(attestation.revocationTime)
    }
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

// async function handleRevokedOffchainEvent(event: Event) {
//   console.log('Revoked offchain event', event)
// }
