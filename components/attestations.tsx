import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { timeAgo } from "@/lib/utils";
import Link from "next/link";
import { AttestationQueryRow } from "@/hooks/query/useAttestationQuery";
import { SchemaNameCard } from "./schema-name-card";

export interface AttestationsProps {
  attestations: AttestationQueryRow[]
}

export function Attestations({ attestations }: AttestationsProps) {

  return (
    <div className="border rounded">
      <Table>
        <TableHeader className="bg-gray-100">
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
          {attestations.map(a => {
            return (<TableRow key={a.id}>
              <TableCell className="link-red long-text-cell">
                <Link href={`/attestation/${a.uid}`}>
                  {a.revoked ? <s className="text-red-500">{a.uid}</s> : a.uid}
                </Link>
              </TableCell>
              <TableCell className="w-48">
                <div className="flex flex-rows space-x-3">
                  <span>#{a.schemaId}</span>
                  {a.schemaName ? <SchemaNameCard name={a.schemaName} /> : ''}
                </div>
              </TableCell>
              <TableCell className="long-text-cell">
                {a.attester}
              </TableCell>
              <TableCell className="long-text-cell">
                {a.recipient}
              </TableCell>
              <TableCell className="w-32">
                {timeAgo(a.time)}
              </TableCell>
            </TableRow>)
          })}
        </TableBody>
      </Table>
    </div>
  );
};
