import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import Link from "next/link";


export interface PaginatorProps {
  prevHref: string
  nextHref: string
  pageCount: number
  page: number
}

export function Paginator({ page, pageCount, prevHref, nextHref }: PaginatorProps) {
  const hasPrev = prevHref !== '#'
  const hasNext = nextHref !== '#'

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <Link legacyBehavior passHref
            className={!hasPrev ? 'pointer-events-none' : ''}
            tabIndex={!hasPrev ? -1 : undefined}
            aria-disabled={!hasPrev}
            href={prevHref}>
            <PaginationPrevious />
          </Link>
        </PaginationItem>
        <PaginationItem>
          Page {page} of {pageCount}
        </PaginationItem>
        <PaginationItem>
          <Link legacyBehavior passHref
            className={!hasNext ? 'pointer-events-none' : ''}
            tabIndex={!hasNext ? -1 : undefined}
            aria-disabled={!hasNext}
            href={nextHref}>
            <PaginationNext />
          </Link>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

