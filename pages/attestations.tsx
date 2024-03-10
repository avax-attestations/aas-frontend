import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { useDb } from "@/hooks/useDb";
import { usePaginator } from "@/hooks/usePaginator";
import { Attestations } from "@/components/pages/attestations";

export default function AttestationsPage() {
  const searchParams = useSearchParams();
  const db = useDb();

  const totalRecords = useLiveQuery(() => db.attestations.count(), [db])

  const pageSize = 20;
  const { page } = usePaginator({
    totalRecords: totalRecords ?? 0,
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

  return (
    <Attestations
      attestations={attestations ?? []}
      schemas={schemas ?? []}
      searchParams={searchParams}
      totalRecords={totalRecords ?? 0}
      pageSize={pageSize}
    />
  );
};
