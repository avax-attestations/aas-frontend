import { useEffect, useState } from "react";
import { type Chain, isChain } from "@/lib/config";
import { usePublicClient, type UsePublicClientReturnType } from "wagmi";

export function useChain() {
  const publicClient = usePublicClient();
  // avalanche is the default chain
  const [chain, setChain] = useState<Chain>(publicClient ? publicClient.chain.name as Chain : "Avalanche");
  const [client, setClient] = useState<UsePublicClientReturnType>();

  useEffect(() => {
    if (typeof window === 'undefined' || !publicClient) {
      return;
    }

    // Workaround to get a non-undefined public client when the wallet is not connected
    setClient(publicClient);
    const chainName = publicClient.chain.name as Chain;

    if (!isChain(chainName)) {
      console.warn(`Invalid chain name "${chainName}"`)
      return;
    }

    setChain(chainName);
  }, [publicClient])

  return { chain, client };
}
