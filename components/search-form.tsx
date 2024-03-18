import { Button } from "@/components/ui/button";
import { type ReadonlyURLSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useEffect, useState } from "react";

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

  useEffect(() => {
    setSearch(searchString);
  }, [searchString]);

  return (
    <form className="flex items-center gap-2">
      <Input
        className="px-4 w-96"
        name="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={placeholder} />
      <Button variant="secondary" asChild>
        <Link href={(() => {
          if (!search) {
            return '#'
          }
          const params = new URLSearchParams(searchParams.toString());
          params.set('search', search);
          return {
            search: params.toString()
          }
        })()}>
          Search
        </Link>
      </Button>
    </form>
  )
}
