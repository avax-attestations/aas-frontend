// based on https://gist.github.com/slavik0329/2e5b6fc31cb745b65d3d37f7cf1d7b36
import { useEffect, useState } from "react";
import { useWalletClient } from "wagmi";
import { type WalletClient } from "viem";
import { BrowserProvider, JsonRpcSigner } from "ethers";

export async function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient;
  if (!chain || !account) {
    return;
  }

  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address
  };

  const provider = new BrowserProvider(transport, network);
  const signer = await provider.getSigner(account.address);

  return signer;
}

export function useSigner() {
  const { data: walletClient } = useWalletClient();

  const [signer, setSigner] = useState<JsonRpcSigner | undefined>(undefined);

  useEffect(() => {
    if (walletClient) {
      walletClientToSigner(walletClient).then((signer) => {
        setSigner(signer);
      })
    }
  }, [walletClient]);

  return signer;
}

