import { useSearchParams } from "next/navigation";
import { useWalletClient } from "wagmi";
import { Schemas } from "@/components/schemas";
import { useSchemaQuery } from "@/hooks/query/useSchemaQuery";
import { Paginator } from "@/components/paginator";
import { Card } from "@/components/card";
import { getPage, usePaginator } from "@/hooks/usePaginator";
import { SearchForm } from "@/components/search-form";

export default function SchemasPage() {
  const searchParams = useSearchParams();
  const { data: walletClient } = useWalletClient();

  const pageSize = 10;

  const {
    schemas,
    recordCount,
  } = useSchemaQuery({
    searchParams,
    pageSize
  });

  const page = getPage(searchParams)
  const {
    prevHref,
    nextHref,
    firstHref,
    lastHref
  } = usePaginator({
    recordCount,
    pageSize,
    searchParams
  })

  return (
    <div>
      <Card className="p-6 flex items-center justify-between">
        <div className="flex flex-col text-center">
          <span className="text-2xl font-bold">{recordCount}</span>
          <span className="ml-2 text-1xl">Schemas found</span>
        </div>

        <div className="flex items-center justify-between">
          <SearchForm
            searchParams={searchParams}
            placeholder="UID, schema UID, attester or recipient"
          />
        </div>
      </Card>
      <Card className="mt-6 py-3">
        <Paginator
          prevHref={prevHref}
          nextHref={nextHref}
          page={page}
          firstHref={firstHref}
          lastHref={lastHref}
          recordCount={recordCount}
          pageSize={pageSize}
        />

        <div className="mt-3">
          <Schemas
            schemas={schemas}
            walletAddress={walletClient?.account.address ?? ''}
          />
        </div>

        <Paginator
          prevHref={prevHref}
          nextHref={nextHref}
          page={page}
          firstHref={firstHref}
          lastHref={lastHref}
          recordCount={recordCount}
          pageSize={pageSize}
        />
      </Card>
    </div>
  );
};
