import { type Database } from './db'
import { PublicClient, decodeEventLog } from 'viem';
import { BLOCK_BATCH_SIZE, DEPLOYMENT, type Chain } from './config';
import { Abi, AbiEvent } from 'abitype';
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
  event: AbiEvent,
  fromBlock: bigint,
  toBlock: bigint
) {
  return Promise.all((await client.getLogs({
    address: contractAddress,
    event: event,
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
      decodedEvent,
      transaction,
      block
    }
  }));
}

export async function index(chain: Chain, db: Database, client: PublicClient) {
  // await db.properties.clear()
  // await db.schemas.clear()
  const schemaRegistryAbi = DEPLOYMENT[chain].schemaRegistry.abi;
  const schemaRegistryAddress = DEPLOYMENT[chain].schemaRegistry.address;

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
    const schemaRegisteredAbi = getEventFromAbi(schemaRegistryAbi, "Registered");
    const schemaRegisteredEvents = await getEventsInBlockRange(
      client,
      schemaRegistryAddress,
      schemaRegistryAbi,
      schemaRegisteredAbi,
      currentBlock,
      toBlock
    )

    currentBlock = toBlock + 1n;

    try {
      await db.transaction('rw', db.properties, db.schemas, async () => {
        await db.properties.put({ key: 'lastBlock', value: currentBlock.toString() });

        for (const schemaRegisteredEvent of schemaRegisteredEvents) {
          const args = schemaRegisteredEvent.decodedEvent.args as any;
          await db.schemas.put({
            uid: args.uid as string,
            schema: args.schema.schema as string,
            creator: schemaRegisteredEvent.transaction.from,
            resolver: args.schema.resolver as string,
            time: schemaRegisteredEvent.block.timestamp.toString().padStart(12, '0'),
            txid: schemaRegisteredEvent.transaction.hash,
            revocable: args.schema.revocable as boolean,
          })
        }
      })
    } catch (err) {
      console.error('DB transaction failed', err)
    }
  }
}
