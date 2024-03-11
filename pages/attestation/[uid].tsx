import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { useSigner } from "@/hooks/useSigner";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/router";
import { useAddresses } from "@/hooks/useAddresses";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { AttestationForm } from "@/components/attestation-form";

export default function AttestationPage() {
  const db = useDb();
  const router = useRouter();
  const signer = useSigner();
  const { toast } = useToast();
  const { easAddress } = useAddresses();

  const uid = router.query['uid'];
  const attestation = useLiveQuery(
    () => db.attestations.where('uid').equals(uid ?? '').first(),
    [db, uid]);

  const schemaUid = attestation?.schemaId;

  const schema = useLiveQuery(
    () => db.schemas.where('uid').equals(schemaUid ?? '').first(),
    [db, schemaUid]);

  return schema && attestation ? (
    <AttestationForm
      schema={schema.schema}
      routerQuery={router.query}
      attestation={{
        recipient: attestation.recipient,
        revocable: attestation.revocable,
        referencedAttestation: attestation.refUID,
        data: attestation.data,
        revoked: attestation.revoked,
      }}
      onSubmit={async (parsedSchema) => {
        if (!signer || !schema || !parsedSchema) {
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
