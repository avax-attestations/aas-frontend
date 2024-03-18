import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { timeAgo, truncateEllipsis } from "@/lib/utils";
import { Paginator } from "@/components/paginator";
import { getPage, usePaginator } from "@/hooks/usePaginator";
import { ReadonlyURLSearchParams } from "next/navigation";
import Link from "next/link";
import { AttestationQueryRow } from "@/hooks/query/useAttestationQuery";
import { SearchForm } from "./search-form";

export interface AttestationsProps {
  attestations: AttestationQueryRow[]
  searchParams: ReadonlyURLSearchParams
  recordCount: number
  pageSize: number
}

export function Attestations({
  recordCount,
  searchParams,
  pageSize,
  attestations,
}: AttestationsProps) {
  const page = getPage(searchParams)
  const {
    pageCount,
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
    <>
      <h1 className="text-3xl font-bold">Attestations</h1>

      <div className="flex items-center justify-between">
        <SearchForm
          searchParams={searchParams}
          placeholder="UID, schema UID, attester or recipient"
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
      <div className="border rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                UID
              </TableHead>
              <TableHead>
                Schema
              </TableHead>
              <TableHead>
                From
              </TableHead>
              <TableHead>
                To
              </TableHead>
              <TableHead>
                Age
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attestations.map(a => {
              const truncatedUid = truncateEllipsis(a.uid, 13)

              return (<TableRow key={a.id}>
                <TableCell>
                  <Link href={`/attestation/${a.uid}`}>
                    {a.revoked ? <s className="text-red-500">{truncatedUid}</s> : truncatedUid}
                  </Link>
                </TableCell>
                <TableCell>
                  #{a.schemaId} {a.schemaName ? `(${a.schemaName})` : ''}
                </TableCell>
                <TableCell>
                  {truncateEllipsis(a.attester, 15)}
                </TableCell>
                <TableCell>
                  {truncateEllipsis(a.recipient, 15)}
                </TableCell>
                <TableCell>
                  {timeAgo(a.time)}
                </TableCell>
              </TableRow>)
            })}
          </TableBody>
        </Table>
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
    </>
  );
};
