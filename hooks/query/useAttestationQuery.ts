import { type ReadonlyURLSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { usePaginator } from "@/hooks/usePaginator";

export interface AttestationQueryRow {
  id: number
  uid: string
  schemaId: number
  schemaName: string
  time: number
  revoked: boolean
  attester: string
  recipient: string
}

export interface UseAttestationQueryOpts {
  searchParams: ReadonlyURLSearchParams
  pageSize: number
}

export interface UseAttestationReturn {
  attestations: AttestationQueryRow[]
  totalRecords: number
}

export function useAttestationQuery({
  searchParams,
  pageSize
}: UseAttestationQueryOpts): UseAttestationReturn {
  const db = useDb();

  const totalRecords = useLiveQuery(() => db.attestations.count(), [db]) ?? 0

  const { page } = usePaginator({
    totalRecords: totalRecords,
    pageSize,
    searchParams
  })

  const searchStr = (searchParams.get('search') ?? '').trim()

  const attestations = useLiveQuery(
    () => searchStr ?
      db.attestations
        .where('uid').startsWithIgnoreCase(searchStr)
        .or('attester').startsWithIgnoreCase(searchStr)
        .or('recipient').startsWithIgnoreCase(searchStr)
        .or('schemaId').startsWithIgnoreCase(searchStr)
        .reverse()
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .sortBy('id') :
      db.attestations
        .orderBy('id')
        .reverse()
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .toArray()
    , [db, page, searchStr])

  const schemas = useLiveQuery(
    () => db.schemas
      .where('uid').anyOf(attestations ? attestations.map(a => a.schemaId) : []).toArray()
    , [attestations])

  const joined = (schemas && attestations) ? attestations.map(a => {
    const schema = schemas.find(s => s.uid === a.schemaId)
    const schemaName = schema?.name ?? ''
    const schemaId = schema?.id ?? -1
    return {
      ...a,
      schemaName,
      schemaId,
      id: a.id ?? -1
    }
  }) : []

  return {
    attestations: joined,
    totalRecords: totalRecords
  }
}
