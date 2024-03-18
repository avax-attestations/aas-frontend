import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { truncateEllipsis } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { type ReadonlyURLSearchParams } from "next/navigation";
import { PlusCircle, SquarePen } from "lucide-react";
import { Paginator } from "@/components/paginator";
import { NAME_SCHEMA_UID as NAME_A_SCHEMA_UID } from "@/lib/config";
import Link from "next/link";
import { getPage, usePaginator } from "@/hooks/usePaginator";
import { SchemaQueryRow } from "@/hooks/query/useSchemaQuery";
import { SearchForm } from "@/components/search-form";

export interface SchemasProps {
  schemas: SchemaQueryRow[]
  searchParams: ReadonlyURLSearchParams
  recordCount: number
  pageSize: number
  walletAddress: string
}

export function Schemas({
  schemas,
  searchParams,
  recordCount,
  pageSize,
  walletAddress,
}: SchemasProps) {
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
      <h1 className="text-3xl font-bold">Schemas</h1>

      <div className="flex items-center justify-between">
        <SearchForm
          searchParams={searchParams}
          placeholder="UID, schema or resolver"
        />

        <Button asChild>
          <Link href="/schema-create">
            <PlusCircle className="w-4 h-4 mr-2" />
            Create Schema
          </Link>
        </Button>
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
                #
              </TableHead>
              <TableHead>
                UID
              </TableHead>
              <TableHead>
                Name
              </TableHead>
              <TableHead>
                Schema
              </TableHead>
              <TableHead>
                Resolver
              </TableHead>
              <TableHead>
                Attestations
              </TableHead>
              <TableHead>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schemas?.map(s => {
              const canEditName = !s.name && s.creator === walletAddress.toLowerCase();
              return (<TableRow key={s.id}>
                <TableCell>
                  #{s.id}
                </TableCell>
                <TableCell>
                  {truncateEllipsis(s.uid, 13)}
                </TableCell>
                <TableCell>
                  {canEditName ? (
                    <Button
                      asChild
                      variant="link"
                      title="Name this schema">
                      <Link href={`/attest/${NAME_A_SCHEMA_UID}?def-schemaId=${s.uid}`}>
                        <SquarePen />
                      </Link>
                    </Button>
                  ) : s.name}
                </TableCell>
                <TableCell>
                  {s.schema}
                </TableCell>
                <TableCell>
                  {truncateEllipsis(s.resolver, 20)}
                </TableCell>
                <TableCell align="center">
                  {s.attestationCount}
                </TableCell>
                <TableCell align="center" >
                  <Button
                    asChild
                    variant="outline"
                    title="Attest with schema">
                    <Link href={`/attest/${s.uid}`}>
                      <PlusCircle className="" />
                    </Link>
                  </Button>
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
