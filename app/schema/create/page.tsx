"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { SchemaRegistry } from "@ethereum-attestation-service/eas-sdk"
import { useSigner } from "@/hooks/useSigner";
import { Trash } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { TYPES } from "@/lib/field-types";
import { useAddresses } from "@/hooks/useAddresses";

const SchemaFieldSchema = z.object({
  name: z.string().min(2, {
    message: "Schema field name must have at least 2 characters"
  }),
  type: z.enum(TYPES),
  array: z.boolean()
})

const FormSchema = z.object({
  fields: z.array(SchemaFieldSchema).min(1),
  resolver: z.union([z.string().length(0), z.string().regex(/\s*(0x[a-f0-9]{40})\s*/, {
    message: 'Invalid resolver address'
  })]),
  revocable: z.boolean()
});

const comboBoxItems = TYPES.map(t => ({ label: t, value: t }))

export default function CreateSchemaPage() {
  const router = useRouter();
  const signer = useSigner();
  const { toast } = useToast()
  const { schemaRegistryAddress } = useAddresses();


  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      fields: [{
        name: '',
        type: 'string',
        array: false
      }],
      resolver: '',
      revocable: true
    }
  })

  const { setValue, getValues } = form

  function addField() {
    setValue('fields',
      getValues().fields.concat([{ name: '', type: 'string', array: false }]))
  }

  function deleteField(index: number) {
    setValue('fields',
      getValues().fields.filter((_, i) => i !== index))
  }

  async function onSubmit(data: z.infer<typeof FormSchema>) {
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
  }

  return (
    <>
      <h1 className="text-3xl font-bold">Create a Schema</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
          <FormField
            control={form.control}
            name="fields"
            render={({ field: fields }) => (
              <FormItem>
                <div className="mb-4">
                  <FormLabel className="text-base">Fields</FormLabel>
                  <FormDescription>
                    Specify one or more fields for the schema.
                  </FormDescription>
                </div>
                {fields.value.map((_, i) => {
                  const field_id = `fields.${i}`
                  return (
                    <FormItem key={field_id}>
                      <div className="grid grid-cols-10 items-center gap-4">
                        <FormField
                          name={`${field_id}.name`}
                          render={({ field }) => (
                            <Input
                              placeholder="Field name"
                              className="col-span-4"
                              {...field}
                            />
                          )} />
                        <FormField
                          name={`${field_id}.type`}
                          render={({ field }) => (
                            <Combobox
                              className="col-span-4"
                              placeholder="Search type"
                              label="Select type"
                              value={field.value}
                              onChange={(v) => field.onChange({ target: { value: v } })}
                              items={comboBoxItems}
                            />
                          )} />
                        <FormField
                          name={`${field_id}.array`}
                          render={({ field }) => (
                            <div className="col-span-1 flex items-center space-x-2">
                              <Checkbox id={`array_${i}`}
                                checked={field.value}
                                onCheckedChange={checked => field.onChange(checked)} />
                              <label
                                htmlFor={`array_${i}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                              >
                                Array
                              </label>
                            </div>
                          )} />
                        {fields.value.length > 1 ?
                          <Button onClick={() => deleteField(i)} variant="secondary" className="col-span-1">
                            <Trash />
                          </Button> : <></>}
                      </div>
                    </FormItem>)
                })}
                <Button variant="secondary" onClick={addField} type="button">
                  Add Field
                </Button>
              </FormItem>
            )}
          />
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
                    If set, attestations of this schema can be revoked.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch id="revocable" checked={getValues().revocable}
                    onClick={_ => setValue('revocable', !getValues().revocable)} />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="resolver"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Resolver address</FormLabel>
                <FormControl>
                  <Input placeholder="ex: 0x0000000000000000000000000000000000000000" {...field} />
                </FormControl>
                <FormDescription>
                  Optional smart contract that gets executed with every attestation of this type.
                  (Can be used to verify, limit, act upon any attestation)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-1">
            <Button type="submit" className="col-span-1">Create Schema</Button>
          </div>
        </form>
      </Form>
    </>
  );
}
