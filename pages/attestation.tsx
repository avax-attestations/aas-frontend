import { EAS } from "@ethereum-attestation-service/eas-sdk";
import type { Schema, Attestation } from '@/lib/db'
import { useSigner } from "@/hooks/useSigner";
import { useRouter } from "next/router";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { useAddresses } from "@/hooks/useAddresses";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { useChain } from "@/hooks/useChain";
import { fetchAttestation } from "@/lib/indexer/query";
import { AttestationView } from "@/components/attestation-view";
import { useEffect, useState } from "react";
import { isChain } from "@/lib/config";
import { wrapDb } from "@/lib/indexer/persist";

export default function AttestationPage() {
  const db = useDb();
  const searchParams = useSearchParams();
  const router = useRouter();
  const signer = useSigner();
  const { client, chain, setChain } = useChain();
  const { toast } = useToast();
  const { easAddress } = useAddresses();
  const [schema, setSchema] = useState<Schema | null>(null);
  const [attestation, setAttestation] = useState<Attestation | null>(null);

  const uid = searchParams.get('uid');
  const queryParamsChain = searchParams.get('chain');

  const localAttestation = useLiveQuery(
    () => db.attestations.where('uid').equals(uid ?? '').first(),
    [db, uid]);

  const schemaUid = localAttestation?.schemaId;

  const localSchema = useLiveQuery(
    () => db.schemas.where('uid').equals(schemaUid ?? '').first(),
    [db, schemaUid]);

  useEffect(() => {
    if (queryParamsChain && chain !== queryParamsChain && isChain(queryParamsChain)) {
      setChain(queryParamsChain);
    }
  }, [queryParamsChain, chain, setChain]);

  useEffect(() => {
    if (localAttestation && localSchema) {
      setAttestation(localAttestation);
      setSchema(localSchema);
      return
    }

    if (!client || !db || !uid) {
      return;
    }

    fetchAttestation(client, uid, wrapDb(db)).then(({ attestation, schema }) => {
      setAttestation(attestation);
      setSchema(schema);
    });

  }, [localAttestation, localSchema, client, db, uid])


  return schema && attestation ? (
    <AttestationView
      schema={schema.schema}
      attestation={attestation}
      onRevoke={async () => {
        if (!signer || !schema) {
          toast({
            variant: 'destructive',
            description: 'Wallet not connected',
            duration: 5000,
          });
          return;
        }

        const eas = new EAS(easAddress);
        eas.connect(signer);

        const t = toast({
          description: 'Revoking attestation...',
          duration: 10000000
        })

        try {
          const tx = await eas.revoke({
            schema: schema.uid,
            data: { uid: attestation.uid }
          });

          await tx.wait(1);
          router.replace('/attestations');
        } catch (err: any) {
          toast({
            variant: 'destructive',
            title: 'Error revoking attestation',
            description: err.message,
            duration: 5000,
          });
        } finally {
          t.dismiss();
        }
      }}
    />
  ) : (
    <div>Loading...</div>
  )
}
