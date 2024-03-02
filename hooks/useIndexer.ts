import { useEffect } from "react";
import { usePublicClient } from "wagmi";
import { index } from "@/lib/indexer";
import { useChain } from "./useChain";
import { useDb } from "./useDb";


export function useIndexer() {
  const client = usePublicClient();
  const chain = useChain();
  const db = useDb();

  useEffect(() => {
    if (typeof window === 'undefined' || !client || !db) {
      return;
    }

    console.log('Indexing chain', chain)

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;

    function run() {
      timeout = null;

      if (unmounted || !client) {
        return;
      }

      index(chain, db, client).then(() => {
        timeout = setTimeout(run, 1000)
      })
    }

    timeout = setTimeout(run, 2000);

    return () => {
      unmounted = true;
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    }
  }, [chain, db, client]);

}
