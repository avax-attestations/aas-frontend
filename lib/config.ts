import { Chain as ViemChain, avalancheFuji, hardhat } from 'viem/chains';
import { Abi } from 'abitype';

import fujiSchemaRegistry from '@ethereum-attestation-service/eas-contracts/deployments/fuji/SchemaRegistry.json'
import fujiEAS from '@ethereum-attestation-service/eas-contracts/deployments/fuji/EAS.json'


const devChains: [ViemChain, ...ViemChain[]] = [
  hardhat
]

const prodChains: [ViemChain, ...ViemChain[]] = [
  avalancheFuji
]

export const NAME_SCHEMA_UID = '0x44d562ac1d7cd77e232978687fea027ace48f719cf1d58c7888e509663bb87fc'

export const chains = process.env.NODE_ENV === 'production' ? prodChains : devChains

export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

// Fuji has a maximum batch size of 2048
export const BLOCK_BATCH_SIZE = 2000n;

type Hash = `0x${string}`

export const DEPLOYMENT = {
  [avalancheFuji.name]: {
    schemaRegistry: {
      address: fujiSchemaRegistry.address as Hash,
      deploymentTxn: fujiSchemaRegistry.transactionHash as Hash,
      abi: fujiSchemaRegistry.abi as Abi
    },
    eas: {
      address: fujiEAS.address as Hash,
      deploymentTxn: fujiEAS.transactionHash as Hash,
      abi: fujiEAS.abi as Abi
    }
  },
  [hardhat.name]: {
    schemaRegistry: {
      address: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Hash,
      deploymentTxn: '0x0' as Hash,
      abi: fujiSchemaRegistry.abi as Abi
    },
    eas: {
      address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as Hash,
      deploymentTxn: '0x0' as Hash,
      abi: fujiEAS.abi as Abi
    }
  },
} as const;

export type Chain = keyof typeof DEPLOYMENT;

export function isChain(key: any): key is Chain {
  return key in DEPLOYMENT;
}
