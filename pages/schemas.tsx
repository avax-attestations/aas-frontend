import { useSearchParams } from "next/navigation";
import { useWalletClient } from "wagmi";
import { Schemas } from "@/components/schemas";
import { useSchemaQuery } from "@/hooks/query/useSchemaQuery";
import { Paginator } from "@/components/paginator";
import { getPage, usePaginator } from "@/hooks/usePaginator";
import { SearchForm } from "@/components/search-form";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { PlusCircle } from "lucide-react";

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
      <div className="p-6 flex flex-col sm:flex-row items-center justify-between">
        <div className="flex flex-col text-center">
          <span className="text-2xl font-bold">{recordCount}</span>
          <span className="sm:ml-2 text-1xl">Schemas found</span>
        </div>

        <div className="flex items-center justify-between space-x-4">
          <SearchForm
            searchParams={searchParams}
            placeholder="UID, schema or resolver"
          />
          <Button asChild variant="aas">
            <Link href="/schema-create">
              <PlusCircle className="w-4 h-4 mr-2" />
              Create Schema
            </Link>
          </Button>
        </div>
      </div>
      <div className="mt-6 py-3">
        <div className="mt-3 table-background">
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
      </div>
    </div>
  );
};
