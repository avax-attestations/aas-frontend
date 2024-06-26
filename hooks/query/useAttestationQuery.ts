import { type ReadonlyURLSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { getPage } from "@/hooks/usePaginator";

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
  searchParams?: ReadonlyURLSearchParams
  pageSize: number
  schemaUid?: string
}

export interface UseAttestationReturn {
  attestations: AttestationQueryRow[]
  recordCount: number
}

export function useAttestationQuery({
  searchParams,
  pageSize,
  schemaUid
}: UseAttestationQueryOpts): UseAttestationReturn {
  const db = useDb();

  const page = searchParams ? getPage(searchParams) : 1
  const searchStr = (searchParams?.get('search') ?? '').trim().toLowerCase()

  function getQuery() {
    let query = db.attestations
      .orderBy('id')
      .reverse()

    if (schemaUid) {
      query = query.filter(a => a.schemaId === schemaUid)
    } else if (searchStr) {
      query = query
        .filter(a =>
          a.uid.toLowerCase().includes(searchStr) ||
          a.attester.toLowerCase().includes(searchStr) ||
          a.recipient.toLowerCase().includes(searchStr) ||
          a.schemaId.toLowerCase().includes(searchStr))
    }

    return query
  }

  const recordCount = useLiveQuery(
    () => getQuery().count()
    , [db, searchStr, schemaUid]) ?? 0

  const attestations = (useLiveQuery(
    () => getQuery()
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .toArray()
    , [db, page, searchStr, schemaUid]) ?? [])

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
    recordCount
  }
}
