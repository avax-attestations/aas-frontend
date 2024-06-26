import { EAS } from "@ethereum-attestation-service/eas-sdk";
import { useSigner } from "@/hooks/useSigner";
import { useRouter } from "next/router";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { useAddresses } from "@/hooks/useAddresses";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { AttestationView } from "@/components/attestation-view";

export default function AttestationPage() {
  const db = useDb();
  const searchParams = useSearchParams();
  const router = useRouter();
  const signer = useSigner();
  const { toast } = useToast();
  const { easAddress } = useAddresses();

  const uid = searchParams.get('uid');
  const attestation = useLiveQuery(
    () => db.attestations.where('uid').equals(uid ?? '').first(),
    [db, uid]);

  const schemaUid = attestation?.schemaId;

  const schema = useLiveQuery(
    () => db.schemas.where('uid').equals(schemaUid ?? '').first(),
    [db, schemaUid]);

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
