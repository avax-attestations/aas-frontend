import { type ReadonlyURLSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { usePaginator } from "@/hooks/usePaginator";

export interface UseAttestationQueryProps {
  searchParams: ReadonlyURLSearchParams
  pageSize: number
}

export function useAttestationQuery({
  searchParams,
  pageSize
} : UseAttestationQueryProps) {
  const db = useDb();

  const totalRecords = useLiveQuery(() => db.attestations.count(), [db]) ?? 0

  const { page } = usePaginator({
    totalRecords: totalRecords,
    pageSize,
    searchParams
  })

  const attestations = useLiveQuery(
    () => db.attestations
      .orderBy('id')
      .reverse()
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .toArray()
    , [db, page])

  const schemas = useLiveQuery(
    () => db.schemas
      .where('uid').anyOf(attestations ? attestations.map(a => a.schemaId) : []).toArray()
    , [attestations])

  return {
    attestations: attestations ?? [],
    schemas: schemas ?? [],
    totalRecords: totalRecords
  }
}
