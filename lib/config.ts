import { Chain as ViemChain, mainnet, arbitrum, optimism, sepolia, avalancheFuji, hardhat } from 'viem/chains';
import { http } from 'viem';
import { Abi } from 'abitype';

import mainnetSchemaRegistry from '@ethereum-attestation-service/eas-contracts/deployments/mainnet/SchemaRegistry.json'
import mainnetEAS from '@ethereum-attestation-service/eas-contracts/deployments/mainnet/EAS.json'

import arbitrumSchemaRegistry from '@ethereum-attestation-service/eas-contracts/deployments/arbitrum-one/SchemaRegistry.json'
import arbitrumEAS from '@ethereum-attestation-service/eas-contracts/deployments/arbitrum-one/EAS.json'

import optimismSchemaRegistry from '@ethereum-attestation-service/eas-contracts/deployments/optimism/SchemaRegistry.json'
import optimismEAS from '@ethereum-attestation-service/eas-contracts/deployments/optimism/EAS.json'

import sepoliaSchemaRegistry from '@ethereum-attestation-service/eas-contracts/deployments/sepolia/SchemaRegistry.json'
import sepoliaEAS from '@ethereum-attestation-service/eas-contracts/deployments/sepolia/EAS.json'

import fujiSchemaRegistry from '@ethereum-attestation-service/eas-contracts/deployments/fuji/SchemaRegistry.json'
import fujiEAS from '@ethereum-attestation-service/eas-contracts/deployments/fuji/EAS.json'

const devChains: [ViemChain, ...ViemChain[]] = [
  hardhat
]

const prodChains: [ViemChain, ...ViemChain[]] = [
  mainnet,
  arbitrum,
  sepolia,
  avalancheFuji
]

export const NAME_SCHEMA_UID = '0x44d562ac1d7cd77e232978687fea027ace48f719cf1d58c7888e509663bb87fc'

export const chains = process.env.NODE_ENV === 'production' ? prodChains : devChains

export const WALLETCONNECT_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!;

type Hash = `0x${string}`

export const DEPLOYMENT = {
  [mainnet.name]: {
    chain: mainnet,
    schemaRegistry: {
      address: mainnetSchemaRegistry.address as Hash,
      deploymentTxn: mainnetSchemaRegistry.transactionHash as Hash,
      abi: mainnetSchemaRegistry.abi as Abi
    },
    eas: {
      address: mainnetEAS.address as Hash,
      deploymentTxn: mainnetEAS.transactionHash as Hash,
      abi: mainnetEAS.abi as Abi
    },
    blockBatchSize: 400n,
    delayBetweenRPCRequests: 1000,
    transportFactory: () => http()
  },
  [arbitrum.name]: {
    chain: arbitrum,
    schemaRegistry: {
      address: arbitrumSchemaRegistry.address as Hash,
      deploymentTxn: arbitrumSchemaRegistry.transactionHash as Hash,
      abi: arbitrumSchemaRegistry.abi as Abi
    },
    eas: {
      address: arbitrumEAS.address as Hash,
      deploymentTxn: arbitrumEAS.transactionHash as Hash,
      abi: arbitrumEAS.abi as Abi
    },
    blockBatchSize: 25000n,
    delayBetweenRPCRequests: 0,
    transportFactory: () => {
      return http(undefined, {
        batch: {
          wait: 0
        }
      })
    }
  },
  [optimism.name]: {
    chain: optimism as unknown as typeof arbitrum,
    schemaRegistry: {
      address: optimismSchemaRegistry.address as Hash,
      deploymentTxn: '0xffee154ed11ab8df29739104900f22450bec3e85790c01a632f04b0056cb92fd' as Hash,
      abi: optimismSchemaRegistry.abi as Abi
    },
    eas: {
      address: optimismEAS.address as Hash,
      deploymentTxn: '0xffee154ed11ab8df29739104900f22450bec3e85790c01a632f04b0056cb92fd' as Hash,
      abi: optimismEAS.abi as Abi
    },
    blockBatchSize: 25000n,
    delayBetweenRPCRequests: 0,
    transportFactory: () => {
      return http(undefined, {
        batch: {
          wait: 0
        }
      })
    }
  },
  [sepolia.name]: {
    chain: sepolia,
    schemaRegistry: {
      address: sepoliaSchemaRegistry.address as Hash,
      deploymentTxn: sepoliaSchemaRegistry.transactionHash as Hash,
      abi: sepoliaSchemaRegistry.abi as Abi
    },
    eas: {
      address: sepoliaEAS.address as Hash,
      deploymentTxn: sepoliaEAS.transactionHash as Hash,
      abi: sepoliaEAS.abi as Abi
    },
    blockBatchSize: 2500n,
    delayBetweenRPCRequests: 0,
    transportFactory: () => {
      return http('https://rpc-sepolia.rockx.com/', {
        batch: {
          wait: 0
        }
      })
    }

  },
  [avalancheFuji.name]: {
    chain: avalancheFuji,
    schemaRegistry: {
      address: fujiSchemaRegistry.address as Hash,
      deploymentTxn: fujiSchemaRegistry.transactionHash as Hash,
      abi: fujiSchemaRegistry.abi as Abi
    },
    eas: {
      address: fujiEAS.address as Hash,
      deploymentTxn: fujiEAS.transactionHash as Hash,
      abi: fujiEAS.abi as Abi
    },
    blockBatchSize: 1024n,
    delayBetweenRPCRequests: 0,
    transportFactory: () => http()
  },
  [hardhat.name]: {
    chain: hardhat,
    schemaRegistry: {
      address: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as Hash,
      deploymentTxn: '0x0' as Hash,
      abi: fujiSchemaRegistry.abi as Abi
    },
    eas: {
      address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as Hash,
      deploymentTxn: '0x0' as Hash,
      abi: fujiEAS.abi as Abi
    },
    blockBatchSize: 2000n,
    delayBetweenRPCRequests: 0,
    transportFactory: () => http()
  },
} as const;

export type Chain = keyof typeof DEPLOYMENT;

export function isChain(key: any): key is Chain {
  return key in DEPLOYMENT;
}
