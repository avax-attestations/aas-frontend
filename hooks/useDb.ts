import { getDb } from '@/lib/db'
import { useChain } from "./useChain";

export function useDb() {
  const { chain } = useChain();
  return getDb(chain);
}
