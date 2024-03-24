import { Button } from "@/components/ui/button";
import { type ReadonlyURLSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { X } from "lucide-react";
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
  const searchRef = useRef(null);
  const clearRef = useRef(null);

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
    params.delete('page');
    return {
      search: params.toString()
    }
  }

  return (
    <div className="flex items-center gap-2 mt-3 sm:mt-0">
      <Input
        className="md:w-96"
        name="search"
        value={search}
        onKeyUp={(e) => {
          if (e.key === 'Enter' && searchRef.current !== null) {
            (searchRef.current as any).click();
          } else if (e.key === 'Escape' && clearRef.current !== null) {
            (clearRef.current as any).click();
          }
        }}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder} />
      <Button variant="secondary" asChild>
        <Link ref={searchRef} href={getSearchUrl(search)}>
          Search
        </Link>
      </Button>
      {searchString && (
        <Link ref={clearRef} href={getSearchUrl('')}>
          <X />
        </Link>
      )}
    </div>
  )
}
