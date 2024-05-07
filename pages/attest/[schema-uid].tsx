import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { useSigner } from "@/hooks/useSigner";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/router";
import { useAddresses } from "@/hooks/useAddresses";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { AttestationForm } from "@/components/attestation-form";
import { ZERO_ADDR } from "@/lib/config"

export default function AttestWithSchemaPage() {
  const db = useDb();
  const router = useRouter();
  const signer = useSigner();
  const { toast } = useToast();
  const { easAddress } = useAddresses();

  const schemaUid = router.query['schema-uid'];
  const schema = useLiveQuery(
    () => db.schemas.where('uid').equals(schemaUid ?? '').first(),
    [db, schemaUid]);

  return schema ? (
    <AttestationForm
      schema={schema.schema}
      routerQuery={router.query}
      onSubmit={async (parsedSchema, data) => {
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

        const schemaEncoder = new SchemaEncoder(schema.schema);

        const toEncode: { name: string, type: string, value: any }[] = [];
        for (const field of parsedSchema.fields) {
          toEncode.push({
            name: field.name,
            type: field.isArray ? `${field.type}[]` : field.type,
            value: data.fields[field.name],
          });
        }

        const encodedData = schemaEncoder.encodeData(toEncode);

        const t = toast({
          description: 'Making attestation...',
          duration: 10000000
        })

        try {
          const tx = await eas.attest({
            schema: schema.uid,
            data: {
              recipient: data.recipient || ZERO_ADDR,
              revocable: data.revocable,
              expirationTime: data.expirationTime,
              data: encodedData,
            }
          });

          await tx.wait(1);
          router.replace('/attestations');
        } catch (err: any) {
          toast({
            variant: 'destructive',
            title: 'Error making attestation',
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
