import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  PaginationFirst,
  PaginationLast,
} from "@/components/ui/pagination"
import Link, { LinkProps } from "next/link";


export interface PaginatorProps {
  prevHref: LinkProps['href']
  nextHref: LinkProps['href']
  firstHref: LinkProps['href']
  lastHref: LinkProps['href']
  page: number
  pageSize: number
  recordCount: number
}

export function Paginator({
  page, prevHref, nextHref, firstHref, lastHref, recordCount, pageSize
}: PaginatorProps) {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <Link legacyBehavior passHref
            href={firstHref}>
            <PaginationFirst />
          </Link>
        </PaginationItem>
        <PaginationItem>
          <Link legacyBehavior passHref
            href={prevHref}>
            <PaginationPrevious />
          </Link>
        </PaginationItem>
        <PaginationItem>
          {page === 1 ? 1 : (page - 1) * pageSize} - {Math.min(page * pageSize, recordCount)} of {recordCount}
        </PaginationItem>
        <PaginationItem>
          <Link legacyBehavior passHref
            href={nextHref}>
            <PaginationNext />
          </Link>
        </PaginationItem>
        <PaginationItem>
          <Link legacyBehavior passHref
            href={lastHref}>
            <PaginationLast />
          </Link>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
