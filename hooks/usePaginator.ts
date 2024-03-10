import { ReadonlyURLSearchParams } from "next/navigation";

export interface PaginatorProps {
  totalRecords: number
  pageSize: number
  searchParams: ReadonlyURLSearchParams
}

function getPageCount(totalRecords: number, pageSize: number): number {
  if (pageSize === 0) {
    throw new Error("Page size must be greater than 0");
  }

  return Math.ceil(totalRecords / pageSize);
}

export function usePaginator({
  totalRecords,
  pageSize,
  searchParams
}: PaginatorProps) {
  const page = (() => {
    const p = parseInt(searchParams.get('page') ?? '1')
    if (Number.isNaN(p)) {
      return 1;
    }
    return p;
  })()

  const pageCount = Math.max(getPageCount(totalRecords ?? 0, pageSize), 1)
  const canGoPrev = page > 1;
  const canGoNext = page < pageCount;
  const prevHref = canGoPrev ? ('?' + new URLSearchParams({
    page: Math.max(page - 1, 1).toString()
  }).toString()) : '#'
  const nextHref = canGoNext ? ('?' + new URLSearchParams({
    page: Math.min(page + 1, pageCount).toString()
  }).toString()) : '#'

  return { page, pageSize, pageCount, prevHref, nextHref }
}
