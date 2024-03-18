import { Button } from "@/components/ui/button";
import { type ReadonlyURLSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface SearchFormProps {
  searchParams: ReadonlyURLSearchParams
  placeholder: string
}

export function SearchForm({
  searchParams,
  placeholder
}: SearchFormProps) {
  const searchString = searchParams.get('search') ?? '';
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    setSearch(searchString);
  }, [searchString]);

  function getSearchUrl(search: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!search) {
      params.delete('search');
    } else {
      params.set('search', search);
    }
    return {
      search: params.toString()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        className="px-4 w-96"
        name="search"
        value={search}
        onKeyUp={(e) => {
          if (e.key === 'Enter' && ref.current !== null) {
            (ref.current as any).click();
          }
        }}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder} />
      <Button variant="secondary" asChild>
        <Link ref={ref} href={getSearchUrl(search)}>
          Search
        </Link>
      </Button>
    </div>
  )
}
