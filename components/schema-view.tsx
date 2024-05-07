import type { Schema } from "@/lib/db";
import { SchemaFieldsCard } from "./schema-fields-card";
import { Attestations } from "./attestations";
import { AttestationQueryRow } from "@/hooks/query/useAttestationQuery";
import { formatDateTime } from "@/lib/utils";
import { Button } from "./ui/button";
import Link from "next/link";
import { PropView } from "./prop-view";

export interface SchemaViewProps {
  schema: Schema
  latestAttestations: AttestationQueryRow[]
}

export function SchemaView({ schema, latestAttestations }: SchemaViewProps) {
  return (
    <>
      <div className="flex flex-row justify-between">
        <h1 className="text-4xl font-semibold tracking-wide">Schema</h1>
        <div className="flex flex-col items-center">
          <Button
            asChild
            variant="aas"
            title="Attest with schema">
            <Link href={`/attest/${schema.uid}`}>
              Attest with this schema
            </Link>
          </Button>
        </div>

      </div>
      <div className="bg-aas-card p-1 mt-5 flex flex-row">
        <div className="p-1 bg-[#666666] text-white rounded">
          <span className="font-semibold">#{schema.id}</span>
        </div>
        <div className="ml-2 p-1">
          <span className="font-semibold">{schema.uid}</span>
        </div>
      </div>

      <div className="bg-aas-card grid grid-cols-2 mt-5 px-3 pb-3 pt-1">
        <div className="flex flex-col">
          <PropView
            label="Created"
            value={formatDateTime(schema.time)} />
          <PropView
            label="Creator"
            value={schema.creator} />
          <PropView
            label="Transaction ID"
            value={schema.txid} />
          <PropView
            label="Resolver Contract"
            value={schema.resolver} />
          <PropView
            label="Revokable Attestation"
            value={schema.revocable ? "Yes" : "No"} />
        </div>
        <div className="flex flex-col ml-2">
          {schema.name ?
            <PropView
              label="Schema Name"
              value={schema.name} />
            : null}
          <div className="mt-1">
            <SchemaFieldsCard schema={schema.schema} />
          </div>
        </div>

      </div>
      {latestAttestations.length > 0 ?
        <div className="pt-5">
          <h1 className="text-2xl font-semibold tracking-wide">Latest attestations</h1>
          <Attestations attestations={latestAttestations} />
        </div>
        : null}
    </>
  );
}
