import { useLiveQuery } from "dexie-react-hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { truncateEllipsis } from "@/lib/utils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PlusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/router";
import { useDb } from "@/hooks/useDb";

function getPageCount(totalRecords: number, pageSize: number): number {
  if (pageSize === 0) {
    throw new Error("Page size must be greater than 0");
  }

  return Math.ceil(totalRecords / pageSize);
}

interface PaginatorProps {
  totalRecords: number
  pageSize: number
  page: number
}

function Paginator({ totalRecords, pageSize, page }: PaginatorProps) {
  const pageCount = Math.max(getPageCount(totalRecords ?? 0, pageSize), 1)
  const canGoPrev = page > 1;
  const canGoNext = page < pageCount;

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <Link legacyBehavior passHref
            className={!canGoPrev ? 'pointer-events-none' : ''}
            tabIndex={!canGoPrev ? -1 : undefined}
            aria-disabled={!canGoPrev}
            href={canGoPrev ? ('?' + new URLSearchParams({
              page: Math.max(page - 1, 1).toString()
            }).toString()) : '#'}>
            <PaginationPrevious />
          </Link>
        </PaginationItem>
        <PaginationItem>
          Page {page} of {pageCount}
        </PaginationItem>
        <PaginationItem>
          <Link legacyBehavior passHref
            className={!canGoNext ? 'pointer-events-none' : ''}
            tabIndex={!canGoNext ? -1 : undefined}
            aria-disabled={!canGoNext}
            href={canGoNext ? ('?' + new URLSearchParams({
              page: Math.min(page + 1, pageCount).toString()
            }).toString()) : '#'}>
            <PaginationNext />
          </Link>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

export default function SchemasPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const db = useDb();

  const page = (() => {
    const p = parseInt(searchParams.get('page') ?? '1')
    if (Number.isNaN(p)) {
      return 1;
    }
    return p;
  })()

  const pageSize = 10;

  const totalRecords = useLiveQuery(() => db.schemas.count(), [db])

  const schemas = useLiveQuery(
    () => db.schemas
      .orderBy('time')
      .reverse()
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .toArray()
    , [db, page])

  return (
    <>
      <h1 className="text-3xl font-bold">Schemas</h1>

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

        <Button onClick={() => router.push("/schema/create")}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Create Schema
        </Button>
      </div>

      <Paginator pageSize={pageSize} totalRecords={totalRecords ?? 0} page={page} />
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
                Schema
              </TableHead>
              <TableHead>
                Resolver
              </TableHead>
              <TableHead>
                Attestations
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schemas?.map(s => (<TableRow key={s.id}>
              <TableCell>
                #{s.id}
              </TableCell>
              <TableCell>
                {truncateEllipsis(s.uid, 13)}
              </TableCell>
              <TableCell>
                {s.schema}
              </TableCell>
              <TableCell>
                {s.resolver}
              </TableCell>
              <TableCell align="center">
                0
              </TableCell>
            </TableRow>))}
          </TableBody>
        </Table>
      </div>
      <Paginator pageSize={pageSize} totalRecords={totalRecords ?? 0} page={page} />
    </>
  );
};
