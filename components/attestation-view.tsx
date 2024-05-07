import { Button } from "@/components/ui/button";
import type { Attestation } from "@/lib/db";
import { parseSchema } from "@/lib/parse-schema";
import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { formatDateTime } from "@/lib/utils";
import { PropView } from "./prop-view";
import Link from "next/link";
import { ZERO_ADDR, ZERO_UID } from "@/lib/config"


export interface AttestationViewProps {
  schema: string
  onRevoke: () => Promise<void>
  attestation: Attestation
}

export function AttestationView({
  schema, attestation, onRevoke
}: AttestationViewProps) {
  const parsedSchema = parseSchema(schema) ?? { fields: [] };

  const decodedAttestation = (() => {
    const fields = {} as Record<string, any>;

    const encoder = new SchemaEncoder(schema);
    const decodedItems = encoder.decodeData(attestation.data);

    for (const decodedItem of decodedItems) {
      fields[decodedItem.value.name] = decodedItem.value.value;
    }

    return {
      recipient: attestation.recipient,
      refUID: attestation.refUID,
      revocable: attestation.revocable,
      fields
    }
  })()

  return (
    <>
      <h1 className="text-4xl font-semibold tracking-wide">Attestation</h1>
      <div className="flex flex-row">
        <div className="bg-aas-card p-1 mt-5 flex flex-row">
          <div className="p-1 bg-[#666666] text-white rounded">
            <span className="font-semibold">#{attestation.id}</span>
          </div>
          <div className="ml-2 p-1">
            <span className="font-semibold">{attestation.uid}</span>
          </div>
        </div>
      </div>

      <div className="bg-aas-card grid grid-cols-2 gap-x-4 mt-5 px-3 pb-3 pt-1">
        <PropView
          label="Created"
          value={formatDateTime(attestation.timeCreated)}
          colSpan={1}
        />
        <PropView
          label="Expiration"
          value={attestation.expirationTime ? formatDateTime(attestation.expirationTime) : "N/A"}
          colSpan={1}
        />
        <div className="bg-[#f2f2f2] rounded p-4 mt-4 mb-3 col-span-2 text-ellipsis">
          <span>SCHEMA:</span>
          <Link href={`/schema?uid=${attestation.schemaId}`}>
            <span className="ml-4 text-red-500">{attestation.schemaId}</span>
          </Link>
        </div>


        {parsedSchema.fields.map(f => {
          const value = decodedAttestation.fields[f.name]
          return (
            <PropView
              key={f.name}
              label={f.name.toUpperCase() + ' | ' + f.type}
              value={value ?? "N/A"}
              colSpan={2}
              marginTop={1}
            />
          )
        })}

        <PropView
          label="Recipient"
          value={attestation.recipient && attestation.recipient !== ZERO_ADDR ? attestation.recipient : 'N/A'}
          colSpan={1}
          marginTop={4} />

        <PropView
          label="Attester"
          value={attestation.attester && attestation.attester !== ZERO_ADDR ? attestation.attester : 'N/A'}
          colSpan={1}
          marginTop={4} />

        <div className="bg-[#f2f2f2] rounded p-4 mt-4 col-span-2 truncate">
          <span>Referenced Attestation:</span>
          {attestation.refUID && attestation.refUID !== ZERO_UID ?
            <Link href={`/attestation/${attestation.refUID}`}>
              <span className="ml-4 text-red-500">{attestation.refUID}</span>
            </Link> :
            <span className="ml-4 font-semibold">N/A</span>
          }
        </div>

        <div className="bg-[#f2f2f2] rounded p-4 col-span-2 mt-4">
          <div>Raw data:</div>
          <pre className="mt-4 bg-[#e5e5e5]">
            <code className="whitespace-pre-wrap">
              {attestation.decodedDataJson}
            </code>
          </pre>
        </div>
      </div>

      <div className="flex flex-col items-center pt-10">
        {!attestation.revoked ?
          <Button type="button" variant="destructive"
            onClick={onRevoke}>Revoke attestation</Button> : <></>}
      </div>
    </>
  );
}
