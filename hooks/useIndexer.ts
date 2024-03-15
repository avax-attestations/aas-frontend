import { useEffect } from "react";
import { usePublicClient } from "wagmi";
import { index, resume } from "@/lib/indexer/persist";
import { useChain } from "./useChain";
import { useDb } from "./useDb";
import { useProvider } from "./useProvider";
import { useRouter } from "next/router";


const POLL_INTERVAL = 60000;

export function useIndexer() {
  const router = useRouter();
  const client = usePublicClient();
  const chain = useChain();
  const db = useDb();
  const provider = useProvider();

  useEffect(() => {
    if (typeof window === 'undefined' || !client || !db || !provider) {
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

      index(chain, client, db).finally(() => {
        timeout = setTimeout(run, POLL_INTERVAL)
      })
    }

    timeout = setTimeout(() => {
      timeout = null;
      resume(chain, db, router.basePath).finally(run)
    }, 1000)

    return () => {
      unmounted = true;
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    }
  }, [chain, db, client, provider, router]);
}
