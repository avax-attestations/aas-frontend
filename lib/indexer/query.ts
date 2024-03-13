import type { TableName, Schema, EntityFromTableName } from '@/lib/db'
import { PublicClient, decodeEventLog, zeroHash } from 'viem';
import { DEPLOYMENT, type Chain } from '@/lib/config';
import { Abi, AbiEvent } from 'abitype';
import { type Attestation as EASAttestation, type EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
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
  eas: EAS,
  db: Database
): Promise<[true, bigint, Mutations] | [false] > {
  const schemaRegistryAbi = DEPLOYMENT[chain].schemaRegistry.abi;
  const schemaRegistryAddress = DEPLOYMENT[chain].schemaRegistry.address;
  const easAbi = DEPLOYMENT[chain].eas.abi;
  const easAddress = DEPLOYMENT[chain].eas.address;
  const blockBatchSize = DEPLOYMENT[chain].blockBatchSize;


  const schemaRegisteredEvent = getEventFromAbi(schemaRegistryAbi, "Registered");
  const attestedEvent = getEventFromAbi(easAbi, "Attested");
  const revokedEvent = getEventFromAbi(easAbi, "Revoked");
  const revokedOffchainEvent = getEventFromAbi(easAbi, "RevokedOffchain");
  const timestampedEvent = getEventFromAbi(easAbi, "Timestamped");

  const schemaRegistryEvents = [schemaRegisteredEvent]
  const easEvents = [attestedEvent, revokedEvent, revokedOffchainEvent, timestampedEvent]

  const fromBlock = await (async () => {
    const result = await db.getLastBlock();
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
  const latestBlock = (await client.getBlock()).number;

  if (currentBlock > latestBlock) {
    return [false]
  }

  const toBlock = min(currentBlock + blockBatchSize, latestBlock);
  if (toBlock - currentBlock > 1n) {
    console.log(`${new Date().toISOString()} - ${chain} - Fetching events from block ${currentBlock} to ${toBlock}`);
  }

  // schemas
  const decodedSchemaRegistryEvents = await getEventsInBlockRange(
    client,
    schemaRegistryAddress,
    schemaRegistryAbi,
    schemaRegistryEvents,
    currentBlock,
    toBlock
  )

  const decodedEasEvents = await getEventsInBlockRange(
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
        mutations.push(...(await handleSchemaRegisteredEvent(event, schemaCache)))
        break;
      case 'Attested':
        mutations.push(...(await handleAttestedEvent(event, eas, db, schemaCache)))
        break;
      case 'Revoked':
        mutations.push(...(await handleRevokedEvent(event, eas)))
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

  return [true, currentBlock, mutations]
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

type Mutations = Mutation<TableName>[]

async function handleSchemaRegisteredEvent(event: Event, schemaCache: Record<string, Schema>): Promise<Mutations> {
  const args = event.decodedEvent.args as any;
  const schema = {
    uid: args.uid as string,
    schema: args.schema.schema as string,
    creator: event.transaction.from,
    resolver: args.schema.resolver as string,
    time: timeToNumber(event.block.timestamp),
    txid: event.transaction.hash,
    revocable: args.schema.revocable as boolean,
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
  getLastBlock: () => Promise<bigint>
}

async function handleAttestedEvent(event: Event, eas: EAS, db: Database, schemaCache: Record<string, Schema>): Promise<Mutations> {
  const args = event.decodedEvent.args as any
  let attestation: EASAttestation

  let tries = 1;
  while (true) {
    const result = await eas.getAttestation(args.uid)

    if (result.uid !== zeroHash) {
      attestation = result;
      break;
    }

    console.log(`Could not find attestation with uid "${args.uid}", retry #${tries} after 5 seconds...`)
    await sleep(5000)
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

async function handleRevokedEvent(event: Event, eas: EAS): Promise<Mutations> {
  const args = event.decodedEvent.args as any

  const attestation = await eas.getAttestation(args.uid)

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
