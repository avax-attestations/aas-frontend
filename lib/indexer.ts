import { type Database, type EntityFromTableName, type TableName, type Attestation, type Schema } from './db'
import { type Table } from 'dexie';
import { PublicClient, decodeEventLog, zeroHash } from 'viem';
import { BLOCK_BATCH_SIZE, DEPLOYMENT, type Chain } from './config';
import { Abi, AbiEvent } from 'abitype';
import { type Attestation as EASAttestation, type EAS, SchemaEncoder } from '@ethereum-attestation-service/eas-sdk';
import { sleep } from './utils';

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


export async function index(chain: Chain, db: Database, client: PublicClient, eas: EAS) {
  // await db.properties.clear()
  // await db.schemas.clear()
  const schemaRegistryAbi = DEPLOYMENT[chain].schemaRegistry.abi;
  const schemaRegistryAddress = DEPLOYMENT[chain].schemaRegistry.address;
  const easAbi = DEPLOYMENT[chain].eas.abi;
  const easAddress = DEPLOYMENT[chain].eas.address;


  const schemaRegisteredEvent = getEventFromAbi(schemaRegistryAbi, "Registered");
  const attestedEvent = getEventFromAbi(easAbi, "Attested");
  const revokedEvent = getEventFromAbi(easAbi, "Revoked");
  const revokedOffchainEvent = getEventFromAbi(easAbi, "RevokedOffchain");
  const timestampedEvent = getEventFromAbi(easAbi, "Timestamped");

  const schemaRegistryEvents = [schemaRegisteredEvent]
  const easEvents = [attestedEvent, revokedEvent, revokedOffchainEvent, timestampedEvent]

  const fromBlock = await (async () => {
    const result = await db.properties.get('lastBlock')
    if (!result) {
      const hash = DEPLOYMENT[chain].schemaRegistry.deploymentTxn
      if (hash === '0x0') {
        return 0n;
      }
      const txn = await client.getTransaction({ hash });
      return txn.blockNumber;
    }
    return BigInt(result.value)
  })();

  let currentBlock = fromBlock;
  const latestBlock = (await client.getBlock()).number;

  while (currentBlock <= latestBlock) {
    const toBlock = min(currentBlock + BLOCK_BATCH_SIZE, latestBlock);
    if (toBlock - currentBlock > 1n) {
      console.log(`${new Date().toISOString()} - Fetching events from block ${currentBlock} to ${toBlock}`);
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
          mutations.push(...(await handleRevokedEvent(event, eas, db, schemaCache)))
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
      console.log(event.decodedEvent.eventName)
    }

    try {
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
    } catch (err) {
      console.error('DB transaction failed, retrying after 5 seconds', err)
      await sleep(5000);
    }
  }
}

type PutMutation<T extends TableName> = {
  operation: 'put'
  table: T
  data: EntityFromTableName<T>
}

type ModifyMutation<T extends TableName> = {
  operation: 'modify'
  table: T
  data: Partial<EntityFromTableName<T>>
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
    time: timeStr(event.block.timestamp),
    txid: event.transaction.hash,
    revocable: args.schema.revocable as boolean,
    name: '',
    attestationCount: 0
  }
  schemaCache[schema.uid] = schema
  return [{
    operation: 'put',
    table: 'schemas',
    data: schema
  }]
}

function timeStr(timestamp: bigint) {
  return timestamp.toString().padStart(12, '0')
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
    const schemas = await db.schemas.where('uid').equals(attestation.schema).toArray()
    if (schemas.length !== 1) {
      throw new Error(`Cannot find schema with uid ${attestation.schema}`)
    }
    return schemas[1]
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
      revocationTime: timeStr(attestation.revocationTime),
      expirationTime: timeStr(attestation.expirationTime),
      time: timeStr(attestation.time),
      txid: event.transaction.hash,
      revoked: attestation.revocationTime < BigInt(timeCreated) && attestation.revocationTime !== 0n,
      timeCreated,
      revocable: attestation.revocable,
      decodedDataJson
    }
  }, {
    operation: 'modify',
    table: 'schemas',
    data: {
      uid: schema.uid,
      attestationCount: schema.attestationCount
    }
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
      const schemas = await db.schemas.where('uid').equals(uid).toArray()
      if (schemas.length !== 1) {
        throw new Error(`Cannot find schema with uid ${uid}`)
      }
      return schemas[1]
    })()

    if (schemaBeingNamed.creator.toLowerCase() === attestation.attester.toLowerCase()) {
      result.push({
        operation: 'modify',
        table: 'schemas',
        data: {
          uid,
          name
        }
      })
    }
  }

  return result
}

async function handleRevokedEvent(event: Event, eas: EAS, db: Database, schemaCache: Record<string, Schema>): Promise<Mutations> {
  const args = event.decodedEvent.args as any

  const attestation = await eas.getAttestation(args.data)

  const result = [{
    operation: 'modify',
    table: 'attestations',
    data: {
      uid: attestation.uid,
      revoked: true,
      revocationTime: timeStr(attestation.revocationTime)
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
      timestamp: timeStr(timestamp),
      from: event.transaction.from,
      txid: event.transaction.hash
    }
  }]
}

// async function handleRevokedOffchainEvent(event: Event) {
//   console.log('Revoked offchain event', event)
// }
