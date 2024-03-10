import { useLiveQuery } from "dexie-react-hooks";
import { useSearchParams } from "next/navigation";
import { useDb } from "@/hooks/useDb";
import { useWalletClient } from "wagmi";
import { Schemas } from "@/components/pages/schemas";
import { usePaginator } from "@/hooks/usePaginator";

export default function SchemasPage() {
  const searchParams = useSearchParams();
  const db = useDb();
  const { data: walletClient } = useWalletClient();

  const totalRecords = useLiveQuery(() => db.schemas.count(), [db])

  const pageSize = 10;
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

  return (
    <Schemas
      schemas={schemas ?? []}
      searchParams={searchParams}
      totalRecords={totalRecords ?? 0}
      pageSize={pageSize}
      walletAddress={walletClient?.account.address ?? ''}
    />
  );
};
