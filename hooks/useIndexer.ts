import { useEffect } from "react";
import { index, resume } from "@/lib/indexer/persist";
import { useChain } from "./useChain";
import { useDb } from "./useDb";
import { useProvider } from "./useProvider";
import { useRouter } from "next/router";


const POLL_INTERVAL = 60000;

export function useIndexer() {
  const router = useRouter();
  const { chain, client } = useChain();
  const db = useDb();
  const provider = useProvider();

  useEffect(() => {
    if (typeof window === 'undefined' || !client || !db || !provider) {
      return;
    }
    console.log('Indexing chain', chain)

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let unmounted = false;
    const signal = { shouldStop: false };

    function run() {
      timeout = null;

      if (unmounted || !client) {
        return;
      }

      index(chain, client, db, signal).finally(() => {
        timeout = setTimeout(run, POLL_INTERVAL)
      })
    }

    timeout = setTimeout(() => {
      timeout = null;
      const basePath = router.basePath !== '/' ? router.basePath : '';
      resume(chain, db, basePath).finally(run)
    }, 1000)

    return () => {
      signal.shouldStop = true;
      unmounted = true;
      if (timeout !== null) {
        clearTimeout(timeout);
      }
    }
  }, [chain, db, client, provider, router]);
}
