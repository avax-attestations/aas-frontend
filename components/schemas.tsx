import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PlusCircle, SquarePen } from "lucide-react";
import { NAME_SCHEMA_UID as NAME_A_SCHEMA_UID } from "@/lib/config";
import Link from "next/link";
import { SchemaQueryRow } from "@/hooks/query/useSchemaQuery";
import { SchemaFieldsCard } from "./schema-fields-card";
import { SchemaNameCard } from "./schema-name-card";

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
            return (<TableRow key={s.id}>
              <TableCell className="w-1">
                #{s.id}
              </TableCell>
              <TableCell className="long-text-cell">
                <Link href={`/schema/${s.uid}`}>
                  <span className="text-red-500">{s.uid}</span>
                </Link>
              </TableCell>
              <TableCell className="w-56">
                {canEditName ? (
                  <Button
                    asChild
                    variant="link"
                    title="Name this schema">
                    <Link href={`/attest/${NAME_A_SCHEMA_UID}?def-schemaId=${s.uid}`}>
                      <SquarePen />
                    </Link>
                  </Button>
                ) : <SchemaNameCard name={s.name} />}
              </TableCell>
              <TableCell className="w-80 p-2">
                <SchemaFieldsCard schema={s.schema} />
              </TableCell>
              <TableCell className="long-text-cell">
                {s.resolver}
              </TableCell>
              <TableCell align="center" className="w-4">
                {s.attestationCount}
              </TableCell>
              <TableCell align="center" className="w-1">
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
