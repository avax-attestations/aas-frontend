import { SchemaRegistry } from "@ethereum-attestation-service/eas-sdk"
import { useSigner } from "@/hooks/useSigner";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/router";
import { useAddresses } from "@/hooks/useAddresses";
import { SchemaCreate } from "@/components/schema-create";

export default function CreateSchemaPage() {
  const router = useRouter();
  const signer = useSigner();
  const { toast } = useToast()
  const { schemaRegistryAddress } = useAddresses();

  return (
    <SchemaCreate
      onSubmit={async (data) => {
        if (!signer) {
          toast({
            variant: 'destructive',
            description: 'Wallet not connected',
            duration: 5000,
          })
          return;
        }

        const schemaRegistry = new SchemaRegistry(schemaRegistryAddress);
        schemaRegistry.connect(signer)

        const schema = data.fields.map(
          f => (`${f.type}${f.array ? '[]' : ''} ${f.name}`)).join(',')
        const resolverAddress = data.resolver.trim() || '0x0000000000000000000000000000000000000000'
        const { revocable } = data;

        const t = toast({
          description: 'Creating schema...',
          duration: 10000000
        })

        try {
          const tx = await schemaRegistry.register({
            schema,
            resolverAddress,
            revocable
          })
          await tx.wait(1)

          router.replace('/schemas');
        } catch (err: any) {
          toast({
            variant: 'destructive',
            title: 'Error creating schema',
            duration: 5000,
            description: err.message
          })
        } finally {
          t.dismiss()
        }
      }}
    />
  );
}
