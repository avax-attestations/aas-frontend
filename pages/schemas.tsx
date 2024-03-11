import { useSearchParams } from "next/navigation";
import { useWalletClient } from "wagmi";
import { Schemas } from "@/components/schemas";
import { useSchemaQuery } from "@/hooks/query/useSchemaQuery";

export default function SchemasPage() {
  const searchParams = useSearchParams();
  const { data: walletClient } = useWalletClient();

  const pageSize = 10;

  const {
    schemas,
    totalRecords,
  } = useSchemaQuery({
    searchParams,
    pageSize
  });

  return (
    <Schemas
      schemas={schemas}
      searchParams={searchParams}
      totalRecords={totalRecords}
      pageSize={pageSize}
      walletAddress={walletClient?.account.address ?? ''}
    />
  );
};
