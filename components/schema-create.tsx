import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Trash } from "lucide-react";
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
type FormData = z.infer<typeof FormSchema>

export interface SchemaCreateProps {
  onSubmit: (data: FormData) => Promise<void>
}

export function SchemaCreate({ onSubmit }: SchemaCreateProps) {
  const form = useForm<FormData>({
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

  return (
    <>
      <h1 className="text-4xl font-semibold tracking-wide">Create a Schema</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
          <div className="bg-aas-card p-4 mt-5">
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
                            <Button onClick={() => deleteField(i)} variant="aas" className="col-span-1">
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
          </div>
          <div className="bg-aas-card p-4 mt-5">
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
          </div>
          <div className="bg-aas-card p-4 mt-5">
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
          </div>
          <div className="flex flex-col items-center pt-5">
            <Button type="submit" variant="aas">Create Schema</Button>
          </div>
        </form>
      </Form>
    </>
  );
}
