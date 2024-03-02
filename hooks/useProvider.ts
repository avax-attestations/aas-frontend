// based on https://gist.github.com/slavik0329/2e5b6fc31cb745b65d3d37f7cf1d7b36
import { JsonRpcProvider, FallbackProvider } from "ethers";
import { type PublicClient } from "viem";
import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";


function publicClientToProvider(publicClient: PublicClient) {
  const { chain, transport } = publicClient;
  if (!chain) {
    return;
  }

  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address
  };

  if (transport.type === "fallback") {
    return new FallbackProvider(
      (transport.transports).map(
        ({ value }: any) => new JsonRpcProvider(value?.url, network)
      )
    );
  }

  return new JsonRpcProvider(transport.url, network);
}

type Provider = ReturnType<typeof publicClientToProvider>

export function useProvider() {
  const publicClient = usePublicClient();
  const [provider, setProvider] = useState<Provider | undefined>(undefined);

  useEffect(() => {
    if (publicClient) {
      setProvider(publicClientToProvider(publicClient));
    }
  }, [publicClient]);

  return provider;
}
