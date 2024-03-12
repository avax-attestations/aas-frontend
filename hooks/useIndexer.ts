import { useEffect } from "react";
import { usePublicClient } from "wagmi";
import { index } from "@/lib/indexer/persist";
import { useChain } from "./useChain";
import { useDb } from "./useDb";
import { EAS, type TransactionSigner } from "@ethereum-attestation-service/eas-sdk"
import { useAddresses } from "./useAddresses";
import { useProvider } from "./useProvider";


const POLL_INTERVAL = 1000;

export function useIndexer() {
  const client = usePublicClient();
  const chain = useChain();
  const db = useDb();
  const { easAddress } = useAddresses();
  const provider = useProvider();

  useEffect(() => {
    if (typeof window === 'undefined' || !client || !db || !provider) {
      return;
    }

    const eas = new EAS(easAddress)
    // This cast to TransactionSigner should be safe if we only want to do read operations.
    eas.connect(provider as unknown as TransactionSigner)
    console.log('Indexing chain', chain)

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;

    function run() {
      timeout = null;

      if (unmounted || !client) {
        return;
      }

      index(chain, client, eas, db).then(() => {
        timeout = setTimeout(run, POLL_INTERVAL)
      })
    }

    timeout = setTimeout(run, 2000);

    return () => {
      unmounted = true;
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    }
  }, [chain, db, client, easAddress, provider]);

}
