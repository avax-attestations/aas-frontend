import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { truncateEllipsis } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlusCircle, SquarePen } from "lucide-react";
import { NAME_SCHEMA_UID as NAME_A_SCHEMA_UID } from "@/lib/config";
import Link from "next/link";
import { SchemaQueryRow } from "@/hooks/query/useSchemaQuery";

export interface SchemasProps {
  schemas: SchemaQueryRow[]
  walletAddress: string
}

export function Schemas({
  schemas,
  walletAddress,
}: SchemasProps) {

  return (
    <div className="border rounded">
      <Table>
        <TableHeader className="bg-gray-100">
          <TableRow>
            <TableHead>
              #
            </TableHead>
            <TableHead>
              UID
            </TableHead>
            <TableHead>
              Name
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
          {schemas?.map(s => {
            const canEditName = !s.name && s.creator === walletAddress.toLowerCase();
            return (<TableRow className="h-24" key={s.id}>
              <TableCell>
                #{s.id}
              </TableCell>
              <TableCell>
                {truncateEllipsis(s.uid, 13)}
              </TableCell>
              <TableCell>
                {canEditName ? (
                  <Button
                    asChild
                    variant="link"
                    title="Name this schema">
                    <Link href={`/attest/${NAME_A_SCHEMA_UID}?def-schemaId=${s.uid}`}>
                      <SquarePen />
                    </Link>
                  </Button>
                ) : s.name}
              </TableCell>
              <TableCell>
                {s.schema}
              </TableCell>
              <TableCell>
                {truncateEllipsis(s.resolver, 20)}
              </TableCell>
              <TableCell align="center">
                {s.attestationCount}
              </TableCell>
              <TableCell align="center" >
                <Button
                  asChild
                  variant="outline"
                  title="Attest with schema">
                  <Link href={`/attest/${s.uid}`}>
                    <PlusCircle className="" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>)
          })}
        </TableBody>
      </Table>
    </div>
  );
};
