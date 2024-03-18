import { ReadonlyURLSearchParams } from "next/navigation";

export interface PaginatorProps {
  recordCount: number
  pageSize: number
  searchParams: ReadonlyURLSearchParams
}

function getPageCount(recordCount: number, pageSize: number): number {
  if (pageSize === 0) {
    throw new Error("Page size must be greater than 0");
  }

  return Math.ceil(recordCount / pageSize);
}

export function getPage(searchParams: ReadonlyURLSearchParams): number {
  const p = parseInt(searchParams.get('page') ?? '1')
  if (Number.isNaN(p)) {
    return 1;
  }
  return p;
}

export function usePaginator({
  recordCount,
  searchParams,
  pageSize,
}: PaginatorProps) {

  const page = getPage(searchParams)
  const pageCount = Math.max(getPageCount(recordCount, pageSize), 1)

  function getUrl(page: number) {
    const params = new URLSearchParams(searchParams)
    if (page < 1) {
      params.delete('page')
    } else if (page > pageCount) {
      params.set('page', pageCount.toString())
    } else {
      params.set('page', page.toString())
    }
    return {
      search: params.toString()
    }
  }

  const prevHref = getUrl(page - 1)
  const nextHref = getUrl(page + 1)
  const firstHref = getUrl(1)
  const lastHref = getUrl(pageCount)

  return { page, pageCount, prevHref, nextHref, firstHref, lastHref }
}
