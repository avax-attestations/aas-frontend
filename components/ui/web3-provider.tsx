"use client"
import React from 'react';

import { WagmiProvider, createConfig } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConnectKitProvider, getDefaultConfig } from 'connectkit';
import { chains, WALLETCONNECT_PROJECT_ID } from '@/lib/config';

const config = createConfig(
  getDefaultConfig({
    ssr: true,
    appName: 'Avalanche Attestation Service',
    walletConnectProjectId: WALLETCONNECT_PROJECT_ID,
    chains
  })
);

const queryClient = new QueryClient();

export const Web3Provider = ({ children }: { children: React.ReactNode }) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider debugMode>{children}</ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
