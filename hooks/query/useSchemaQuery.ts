import { type ReadonlyURLSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { getPage } from "@/hooks/usePaginator";

export interface SchemaQueryRow {
  id: number
  uid: string
  name: string
  schema: string
  resolver: string
  attestationCount: number
  creator: string
}

export type UseSchemaQueryOpts = {
  searchParams: ReadonlyURLSearchParams
  pageSize: number
}

export type SchemaQueryReturn = {
  schemas: SchemaQueryRow[]
  recordCount: number
}


export function useSchemaQuery({
  searchParams,
  pageSize
}: UseSchemaQueryOpts): SchemaQueryReturn {
  const db = useDb();

  const page = getPage(searchParams)
  const searchStr = (searchParams.get('search') ?? '').trim().toLowerCase()

  function getQuery() {
    let query = db.schemas
      .orderBy('id')
      .reverse()

    if (searchStr) {
      query = query
        .filter(s =>
          s.name.toLowerCase().includes(searchStr) ||
          s.schema.toLowerCase().includes(searchStr) ||
          s.uid.toLowerCase().includes(searchStr) ||
          s.resolver.toLowerCase().includes(searchStr))
    }

    return query
  }

  const recordCount = useLiveQuery(
    () => getQuery().count()
    , [db, searchStr]) ?? 0

  const schemas = (useLiveQuery(
    () => getQuery()
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .toArray()
    , [db, page, searchStr]) ?? []).map(s => ({ ...s, id: s.id ?? -1 }))

  return {
    schemas,
    recordCount
  }
}
