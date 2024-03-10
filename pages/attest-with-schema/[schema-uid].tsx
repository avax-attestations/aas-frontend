import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
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
import { ControllerProps, useForm, UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { useAddresses } from "@/hooks/useAddresses";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { FIELD_REGEX, type FieldType } from "@/lib/field-types";
import { PlusCircle, Trash } from "lucide-react";
import { useCallback } from "react";


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

type FormFieldRenderer = ControllerProps<any, any>['render'];

type NestedFieldProps = {
  fieldSchema: ParsedSchemaField
  form: UseFormReturn<any, any, any>
}

type NestedFormProps = {
  schema: ParsedSchema
  form: UseFormReturn<any, any, any>
}

function FormFieldInputFromSchema({ fieldSchema, form }: NestedFieldProps): FormFieldRenderer {
  const { setValue, getValues } = form;
  if (fieldSchema.isArray) {
    const FieldInput: FormFieldRenderer = ({ field }) => {
      const items = (field.value || []) as any[];

      function deleteField(index: number) {
        const items = getValues(field.name)
        setValue(field.name, items.filter((_: any, i: number) => i !== index));
      }

      function addField() {
        const items = getValues(field.name) ?? []
        setValue(field.name,
          [...items, getFieldDefaultValue({ ...fieldSchema, isArray: false })]);
      }

      return (
        <FormItem>
          <div className="space-y-0.5">
            <FormLabel className="text-base">
              {fieldSchema.name.toUpperCase()} | {fieldSchema.type}[]
            </FormLabel>
          </div>
          {items.map((_, i) => {
            const id = `${field.name}.${i}`;
            return (
              <div key={id} className="grid grid-cols-12 items-center gap-4">
                <div className="col-span-1">
                </div>
                <FormField
                  name={id}
                  render={({ field }) => (
                    <FormItem className="col-span-10">
                      {fieldSchema.type === 'bool' ? (<>
                        <Switch checked={!!field.value}
                          onClick={_ => {
                            return field.onChange(!field.value)
                          }} />
                      </>) : (<>
                        <Input {...field} value={getValues(field.name)} placeholder={`${field.name.slice(7)}`} />
                        <FormMessage />
                      </>)}
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  onClick={() => deleteField(i)}
                  variant="secondary"
                  className="col-span-1">
                  <Trash />
                </Button>
              </div>
            )
          })}

          <div className="grid grid-cols-12 items-center gap-4">
            <div className="col-span-1">
            </div>
            <Button
              className="col-span-11"
              type="button"
              variant="secondary"
              onClick={addField}
              title="Add field">
              <PlusCircle />
            </Button>
          </div>
        </FormItem>
      )
    }
    return FieldInput
  }

  if (fieldSchema.type === 'bool') {
    const FieldInput: FormFieldRenderer = ({ field }) => (
      <FormItem>
        <div className="space-y-0.5">
          <FormLabel className="text-base">
            {fieldSchema.name.toUpperCase()} | {fieldSchema.type}
          </FormLabel>
        </div>
        <FormControl>
          <Switch checked={!!field.value}
            onClick={_ => {
              return field.onChange(!field.value)
            }} />
        </FormControl>
      </FormItem>
    )
    return FieldInput
  }

  const FieldInput: FormFieldRenderer = ({ field }) => (
    <FormItem>
      <FormLabel>{fieldSchema.name.toUpperCase()} | {fieldSchema.type}</FormLabel>
      <Input {...field} />
      <FormMessage />
    </FormItem>
  )
  return FieldInput
}

function FormFieldFromSchema(props: NestedFieldProps) {
  return (<FormField
    name={`fields.${props.fieldSchema.name}`}
    render={FormFieldInputFromSchema(props)}
  />
  );
}

function FormFieldsFromSchema(props: NestedFormProps) {
  return (<>{
    props.schema.fields.map((field, i) => (
      <FormFieldFromSchema key={i} fieldSchema={field} form={props.form} />
    ))}</>)
}

function BuildFormSchema(schema: ParsedSchema | null) {
  const BaseSchema = {
    recipient: z.union([z.string().length(0), z.string().regex(/\s*(0x[a-f0-9]{40})\s*/, {
      message: 'Invalid resolver address'
    })]),
    revocable: z.boolean(),
    expirationTime: z.optional(z.bigint().min(0n)).default(0n),
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
        fields[field.name] = z.boolean().default(false)
        break;
      case 'bytes':
      case 'bytes32': {
        const bytes32Regex = /^0x(?:[a-f0-9]{2}){32}$/i
        const bytesRegex = /^0x(?:[a-f0-9]{2})+$/i
        fields[field.name] = z.string().regex(
          field.type == 'bytes32' ? bytes32Regex : bytesRegex, {
          message: `Invalid ${field.type} string`
        })
        break;
      }
      default: {
        // get the number of bits from the type
        const bits = parseInt(field.type.slice(4));
        fields[field.name] = z.union([z.string(), z.bigint()]).transform(v => {
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

    if (field.isArray) {
      fields[field.name] = z.array(fields[field.name]).default([]);
    }
  }

  return z.object({
    ...BaseSchema,
    fields: z.object(fields),
  });
}


function getFieldDefaultValue(field: ParsedSchemaField) {
  if (field.isArray) {
    return [];
  } else {
    switch (field.type) {
      case 'bool':
        return false;
      case 'address':
      case 'string':
      case 'bytes':
      case 'bytes32':
        return '';
      default:
        return undefined;
    }
  }
}

function getFieldsDefaultValues(schema: ParsedSchema | null): Record<string, any> {
  if (!schema) {
    return {};
  }

  const fields = {} as Record<string, any>;

  for (const field of schema.fields) {
    fields[field.name] = getFieldDefaultValue(field);
  }

  return fields;
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
      revocable: true,
      fields: getFieldsDefaultValues(parsedSchema)
    }
  });

  const { setValue, getValues } = form;

  const onSubmit = useCallback(async (data: z.infer<typeof FormSchema>) => {
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

    debugger
    const encodedData = schemaEncoder.encodeData(toEncode);

    const t = toast({
      description: 'Making attestation...',
      duration: 10000000
    })

    try {
      const tx = await eas.attest({
        schema: schema.uid,
        data: {
          recipient: data.recipient || '0x0000000000000000000000000000000000000000',
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


  }, [easAddress, signer, toast, schema, parsedSchema, router])

  return (
    <>
      <h1 className="text-3xl font-bold">Attest with schema</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
          {parsedSchema && parsedSchema.fields.length > 0 && (
            <FormFieldsFromSchema schema={parsedSchema} form={form} />
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

