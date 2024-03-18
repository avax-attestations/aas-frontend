import { type ReadonlyURLSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { usePaginator } from "@/hooks/usePaginator";

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
  totalRecords: number
}

export function useSchemaQuery({
  searchParams,
  pageSize
}: UseSchemaQueryOpts): SchemaQueryReturn {
  const db = useDb();

  const totalRecords = useLiveQuery(() => db.schemas.count(), [db]) ?? 0

  const { page } = usePaginator({
    totalRecords: totalRecords,
    pageSize,
    searchParams
  })

  const searchStr = (searchParams.get('search') ?? '').trim()

  const schemas = (useLiveQuery(
    () => searchStr ?
      db.schemas
        .where('name').startsWithIgnoreCase(searchStr)
        .or('uid').startsWithIgnoreCase(searchStr)
        .or('resolver').startsWithIgnoreCase(searchStr)
        .reverse()
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .sortBy('id') :
      db.schemas
        .orderBy('id')
        .reverse()
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .toArray()
    , [db, page, searchStr]) ?? []).map(s => ({ ...s, id: s.id ?? -1 }))

  return {
    schemas,
    totalRecords
  }
}
