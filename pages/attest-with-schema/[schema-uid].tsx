import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EAS } from "@ethereum-attestation-service/eas-sdk";
import { useSigner } from "@/hooks/useSigner";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/router";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAddresses } from "@/hooks/useAddresses";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { FIELD_REGEX, type FieldType } from "@/lib/field-types";


type ParsedSchemaField = {
  type: FieldType
  name: string
  isArray: boolean
}

type ParsedSchema = {
  fields: ParsedSchemaField[]
}

function parseSchema(schema: string): ParsedSchema | null {
  const fields: ParsedSchemaField[] = [];
  for (const field of schema.split(',')) {
    const match = FIELD_REGEX.exec(field);
    if (!match) {
      return null;
    }
    const [, type, isArray, name] = match;
    fields.push({
      type: type as FieldType,
      name,
      isArray: isArray === '[]'
    });
  }
  return { fields };
}


function FormFieldFromSchema({ fieldSchema }: { fieldSchema: ParsedSchemaField }) {
  return (<FormField
    name={`fields.${fieldSchema.name}`}
    render={({ field }) => (
      <>
        <FormItem>
          <FormLabel>{fieldSchema.name.toUpperCase()} | {fieldSchema.type}</FormLabel>
          <Input {...field} />
          <FormMessage />
        </FormItem>
      </>
    )}
  />
  );
}

function FormFieldsFromSchema({ schema }: { schema: ParsedSchema }) {
  return (<>{
    schema.fields.map((field, i) => (
      <FormFieldFromSchema key={i} fieldSchema={field} />
    ))}</>)
}

function BuildFormSchema(schema: ParsedSchema | null) {
  const BaseSchema = {
    recipient: z.union([z.string().length(0), z.string().regex(/\s*(0x[a-f0-9]{40})\s*/, {
      message: 'Invalid resolver address'
    })]),
    revocable: z.boolean(),
    expirationTime: z.optional(z.number().int().min(0)),
    referencedAttestation: z.union([z.string().length(0), z.string().regex(/\s*(0x[a-f0-9]{64})\s*/, {
      message: 'Invalid attestation uid'
    })])
  }

  if (!schema) {
    return z.object({
      ...BaseSchema,
      fields: z.record(z.any())
    });
  }

  const fields = {} as Record<string, z.ZodType<any, any, any>>;

  for (const field of schema.fields) {
    switch (field.type) {
      case 'address':
        fields[field.name] = z.string().regex(/\s*(0x[a-f0-9]{40})\s*/, {
          message: 'Invalid address'
        })
        break
      case 'string':
        fields[field.name] = z.string()
        break;
      case 'bool':
        fields[field.name] = z.string()
        break;
      case 'bytes':
      case 'bytes32': {
        const bytes32Regex = /^[a-f0-9]{1,64}$/i
        const bytesRegex = /^[a-f0-9]+$/i
        fields[field.name] = z.string().regex(
          field.type == 'bytes32' ? bytes32Regex : bytesRegex, {
          message: `Invalid ${field.type} string`
        })
        break;
      }
      case 'uint8':
      case 'uint16':
      case 'uint24':
      case 'uint32':
      case 'uint40':
      case 'uint48':
      case 'uint56':
      case 'uint64':
      case 'uint72':
      case 'uint80':
      case 'uint88':
      case 'uint96':
      case 'uint104':
      case 'uint112':
      case 'uint120':
      case 'uint128':
      case 'uint136':
      case 'uint144':
      case 'uint152':
      case 'uint160':
      case 'uint168':
      case 'uint176':
      case 'uint184':
      case 'uint192':
      case 'uint200':
      case 'uint208':
      case 'uint216':
      case 'uint224':
      case 'uint232':
      case 'uint240':
      case 'uint248':
      case 'uint256': {
        // get the number of bits from the type
        const bits = parseInt(field.type.slice(4));
        fields[field.name] = z.string().transform(v => {
          try {
            return BigInt(v);
          } catch (e) {
            return -1n;
          }
        }).pipe(z.bigint({
          coerce: true,
        }).nonnegative().max((1n << BigInt(bits)) - 1n))
        break;
      }
    }
  }

  return z.object({
    ...BaseSchema,
    fields: z.object(fields),
  });
}

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

  const parsedSchema = schema ? parseSchema(schema.schema) : null;
  const FormSchema = BuildFormSchema(parsedSchema);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      recipient: '',
      referencedAttestation: '',
      revocable: true
    }
  });

  const { setValue, getValues } = form;

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    console.log('form data', data);

    if (!signer) {
      toast({
        variant: 'destructive',
        description: 'Wallet not connected',
        duration: 5000,
      });
      return;
    }
  }

  return (
    <>
      <h1 className="text-3xl font-bold">Attest with schema</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
          {parsedSchema && parsedSchema.fields.length > 0 && (
            <FormFieldsFromSchema schema={parsedSchema} />
          )}
          <FormField
            control={form.control}
            name="referencedAttestation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Referenced Attestation UID (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="ex: 0x0000000000000000000000000000000000000000000000000000000000000000" {...field} />
                </FormControl>
                <FormDescription>
                  UID of an attestation you want to reference.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          <FormField
            control={form.control}
            name="revocable"
            render={() => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Revocable
                  </FormLabel>
                  <FormDescription>
                    Allow the attestation to be revoked in the future.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch id="revocable" checked={getValues().revocable}
                    onClick={_ => setValue('revocable', !getValues().revocable)} />
                </FormControl>
              </FormItem>
            )} />
          <div className="grid grid-cols-1">
            <Button type="submit" className="col-span-1">Make attestation</Button>
          </div>
        </form>
      </Form>
    </>
  );
}

