import { type ReadonlyURLSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { usePaginator } from "@/hooks/usePaginator";

export type UseSchemaQueryProps = {
  searchParams: ReadonlyURLSearchParams
  pageSize: number
}

export function useSchemaQuery({
  searchParams,
  pageSize
} : UseSchemaQueryProps) {
  const db = useDb();

  const totalRecords = useLiveQuery(() => db.schemas.count(), [db])

  const { page } = usePaginator({
    totalRecords: totalRecords ?? 0,
    pageSize,
    searchParams
  })

  const schemas = useLiveQuery(
    () => db.schemas
      .orderBy('id')
      .reverse()
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .toArray()
    , [db, page])

  return {
    schemas: schemas ?? [],
    totalRecords: totalRecords ?? 0,
  }
}
