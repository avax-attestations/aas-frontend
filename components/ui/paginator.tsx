import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import Link from "next/link";


function getPageCount(totalRecords: number, pageSize: number): number {
  if (pageSize === 0) {
    throw new Error("Page size must be greater than 0");
  }

  return Math.ceil(totalRecords / pageSize);
}


export interface PaginatorProps {
  totalRecords: number
  pageSize: number
  page: number
}

export function Paginator({ totalRecords, pageSize, page }: PaginatorProps) {
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

