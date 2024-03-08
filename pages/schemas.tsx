import { useLiveQuery } from "dexie-react-hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { truncateEllipsis } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/router";
import { useDb } from "@/hooks/useDb";
import { Paginator } from "@/components/ui/paginator";

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
      .orderBy('id')
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
              <TableHead>
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
                {s.name ? `(${s.name})` : ''} {s.schema}
              </TableCell>
              <TableCell>
                {truncateEllipsis(s.resolver, 20)}
              </TableCell>
              <TableCell align="center">
                {s.attestationCount}
              </TableCell>
              <TableCell align="center" >
                <Button
                  variant="outline"
                  onClick={() => router.push(`/attest-with-schema/${s.uid}`)}
                  title="Attest with schema">
                  <PlusCircle className="" />
                </Button>
              </TableCell>
            </TableRow>))}
          </TableBody>
        </Table>
      </div>
      <Paginator pageSize={pageSize} totalRecords={totalRecords ?? 0} page={page} />
    </>
  );
};
