import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { timeAgo, truncateEllipsis } from "@/lib/utils";
import { ReadonlyURLSearchParams } from "next/navigation";
import Link from "next/link";
import { AttestationQueryRow } from "@/hooks/query/useAttestationQuery";

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
            const truncatedUid = truncateEllipsis(a.uid, 13)

            return (<TableRow className="h-24" key={a.id}>
              <TableCell className="link">
                <Link href={`/attestation/${a.uid}`}>
                  {a.revoked ? <s className="text-red-500">{truncatedUid}</s> : truncatedUid}
                </Link>
              </TableCell>
              <TableCell>
                #{a.schemaId} {a.schemaName ? `(${a.schemaName})` : ''}
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
            </TableRow>)
          })}
        </TableBody>
      </Table>
    </div>
  );
};
