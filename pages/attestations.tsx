import { useSearchParams } from "next/navigation";
import { Attestations } from "@/components/attestations";
import { useAttestationQuery } from "@/hooks/query/useAttestationQuery";
import { SearchForm } from "@/components/search-form";
import { Paginator } from "@/components/paginator";
import { getPage, usePaginator } from "@/hooks/usePaginator";
import { Card } from "@/components/card";

export default function AttestationsPage() {
  const searchParams = useSearchParams();

  const pageSize = 20;

  const {
    attestations,
    recordCount,
  } = useAttestationQuery({
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
      <Card className="p-6 flex flex-col sm:flex-row items-center justify-between">
        <div className="flex flex-col text-center">
          <span className="text-2xl font-bold">{recordCount}</span>
          <span className="sm:ml-2 text-1xl">Attestations found</span>
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
          <Attestations attestations={attestations} />
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
