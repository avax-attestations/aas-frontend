import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { timeAgo, truncateEllipsis } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paginator } from "@/components/paginator";
import { usePaginator } from "@/hooks/usePaginator";
import { ReadonlyURLSearchParams } from "next/navigation";
import Link from "next/link";
import { AttestationQueryRow } from "@/hooks/query/useAttestationQuery";

export interface AttestationsProps {
  attestations: AttestationQueryRow[]
  searchParams: ReadonlyURLSearchParams
  totalRecords: number
  pageSize: number
}

export function Attestations({
  totalRecords,
  searchParams,
  attestations,
}: AttestationsProps) {

  const {
    page,
    pageCount,
    prevHref,
    nextHref
  } = usePaginator({
    totalRecords: totalRecords ?? 0,
    pageSize: 20,
    searchParams
  })

  return (
    <>
      <h1 className="text-3xl font-bold">Attestations</h1>

      <div className="flex items-center justify-between">
        <form className="flex items-center gap-2">
          <Input
            className="px-16"
            name="search"
            placeholder="UID, schema or resolver" />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      <Paginator prevHref={prevHref} nextHref={nextHref} pageCount={pageCount} page={page} />
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
      <Paginator prevHref={prevHref} nextHref={nextHref} pageCount={pageCount} page={page} />
    </>
  );
};
