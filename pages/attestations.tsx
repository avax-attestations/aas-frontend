import { useLiveQuery } from "dexie-react-hooks";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { timeAgo, truncateEllipsis } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { PlusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/router";
import { useDb } from "@/hooks/useDb";
import { Paginator } from "@/components/ui/paginator";

export default function AttestationsPage() {
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

  const pageSize = 20;

  const totalRecords = useLiveQuery(() => db.attestations.count(), [db])

  const attestations = useLiveQuery(
    () => db.attestations
      .orderBy('id')
      .reverse()
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .toArray()
    , [db, page])

  const schemas = useLiveQuery(
    () => db.schemas
      .where('uid').anyOf(attestations ? attestations.map(a => a.schemaId) : []).toArray()
    , [attestations])

  const joined = (schemas && attestations) ? attestations.map(a => {
    const schema = schemas.find(s => s.uid === a.schemaId)
    const schemaName = schema?.name ?? ''
    const schemaOrdinal = schema?.id ?? -1
    return {
      ...a,
      schemaName,
      schemaOrdinal
    }
  }) : []

  return (
    <>
      <h1 className="text-3xl font-bold">Attestations</h1>

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
      </div>

      <Paginator pageSize={pageSize} totalRecords={totalRecords ?? 0} page={page} />
      <div className="border rounded">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                UID
              </TableHead>
              <TableHead>
                Schema
              </TableHead>
              <TableHead>
                From
              </TableHead>
              <TableHead>
                To
              </TableHead>
              <TableHead>
                Age
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {joined?.map(a => (<TableRow key={a.id}>
              <TableCell>
                {truncateEllipsis(a.uid, 13)}
              </TableCell>
              <TableCell>
                #{a.schemaOrdinal} {a.schemaName ? `(${a.schemaName})` : ''}
              </TableCell> 
              <TableCell>
                {truncateEllipsis(a.attester, 15)}
              </TableCell>
              <TableCell>
                {truncateEllipsis(a.recipient, 15)}
              </TableCell>
              <TableCell>
                {timeAgo(a.time)}
              </TableCell>
            </TableRow>))}
          </TableBody>
        </Table>
      </div>
      <Paginator pageSize={pageSize} totalRecords={totalRecords ?? 0} page={page} />
    </>
  );
};
