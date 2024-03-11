import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { zodResolver } from "@hookform/resolvers/zod";
import { ControllerProps, useForm, UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { FIELD_REGEX, type FieldType } from "@/lib/field-types";
import { Minus, Plus, PlusCircle, Trash } from "lucide-react";
import { ParsedUrlQuery } from "querystring";
import { useState } from "react";
import { SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { truncateEllipsis } from "@/lib/utils";

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
  ro?: boolean
}

type NestedFormProps = {
  schema: ParsedSchema
  form: UseFormReturn<any, any, any>
  ro?: boolean
}

function FormFieldInputFromSchema({ fieldSchema, form, ro }: NestedFieldProps): FormFieldRenderer {
  const { setValue, getValues } = form;
  if (fieldSchema.isArray) {
    const FieldInput: FormFieldRenderer = ({ field }) => {
      const items = (field.value || []) as any[];

      function deleteItem(index: number) {
        const items = getValues(field.name)
        setValue(field.name, items.filter((_: any, i: number) => i !== index));
      }

      function addItem() {
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
                        <Switch
                          checked={!!field.value}
                          onClick={_ => {
                            return ro ? null : field.onChange(!field.value)
                          }} />
                      </>) : (<>
                        <Input
                          {...field}
                          value={getValues(field.name)}
                          placeholder={`${field.name.slice(7)}`}
                          readOnly={ro}
                        />
                        <FormMessage />
                      </>)}
                    </FormItem>
                  )}
                />
                {!ro ?
                  <Button
                    type="button"
                    onClick={() => deleteItem(i)}
                    variant="secondary"
                    className="col-span-1">
                    <Trash />
                  </Button>
                  : <></>}
              </div>
            )
          })}

          <div className="grid grid-cols-12 items-center gap-4">
            <div className="col-span-1">
            </div>
            {!ro ?
              <Button
                className="col-span-11"
                type="button"
                variant="secondary"
                onClick={addItem}
                title="Add item">
                <PlusCircle />
              </Button> : <></>}
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
          <Switch checked={getValues(field.name)}
            onClick={_ => {
              return ro ? null : field.onChange(!field.value)
            }} />
        </FormControl>
      </FormItem>
    )
    return FieldInput
  }

  const FieldInput: FormFieldRenderer = ({ field }) => {
    const value = getValues(field.name)
    return (
      <FormItem>
        <FormLabel>{fieldSchema.name.toUpperCase()} | {fieldSchema.type}</FormLabel>
        <Input readOnly={ro} {...field} value={value} />
        <FormMessage />
      </FormItem>
    )
  }
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
      <FormFieldFromSchema key={i} fieldSchema={field} form={props.form} ro={props.ro} />
    ))}</>)
}

function BuildFormSchema(schema: ParsedSchema) {
  const BaseSchema = {
    recipient: z.union([z.string().length(0), z.string().regex(/^\s*(?:0x[a-fA-F0-9]{40}|[a-zA-Z0-9-]+\.eth)\s*$/, {
      message: 'Invalid resolver address'
    })]),
    revocable: z.boolean(),
    expirationTime: z.optional(z.bigint().min(0n)).default(0n),
    referencedAttestation: z.union([z.string().length(0), z.string().regex(/\s*(0x[a-f0-9]{64})\s*/, {
      message: 'Invalid attestation uid'
    })])
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

function getFieldsDefaultValues(schema: ParsedSchema | null, routerQuery: ParsedUrlQuery): Record<string, any> {
  const defaults = {} as Record<string, any>;

  for (const [key, value] of Object.entries(routerQuery)) {
    if (key.startsWith('def-')) {
      const fieldName = key.slice(4);
      defaults[fieldName] = value;
    }
  }

  if (!schema) {
    return defaults;
  }

  for (const field of schema.fields) {
    const key = field.name
    if (!Object.hasOwn(defaults, key)) {
      defaults[key] = getFieldDefaultValue(field)
    }
  }

  return defaults;
}

type AttestWithSchemaFormSchema = z.infer<ReturnType<typeof BuildFormSchema>>;

export interface AttestWithSchemaProps {
  schema: string
  routerQuery: ParsedUrlQuery
  onSubmit: (parsedSchema: ParsedSchema, data: AttestWithSchemaFormSchema) => Promise<void>
  attestation?: {
    data: string,
    recipient: string,
    referencedAttestation: string,
    revocable: boolean
    revoked: boolean
    uid: string
  }
}

export function AttestationForm({
  schema, routerQuery, onSubmit, attestation
}: AttestWithSchemaProps) {
  const readOnly = !!attestation;
  const [advancedOptionsOpen, setAdvancedOptionsOpen] = useState(false)
  const parsedSchema = parseSchema(schema) ?? { fields: [] };
  const FormSchema = BuildFormSchema(parsedSchema);

  const defaultFieldValues = getFieldsDefaultValues(parsedSchema, routerQuery);

  const decodedAttestation = (() => {
    if (!attestation) {
      return null
    }
    const fields = {} as Record<string, any>;

    const encoder = new SchemaEncoder(schema);
    const decodedItems = encoder.decodeData(attestation.data);

    for (const decodedItem of decodedItems) {
      fields[decodedItem.value.name] = decodedItem.value.value;
    }

    return {
      recipient: attestation.recipient,
      referencedAttestation: attestation.referencedAttestation,
      revocable: attestation.revocable,
      fields
    }
  })()

  const defaultValues = decodedAttestation ?? {
    recipient: '',
    referencedAttestation: '',
    revocable: true,
    fields: defaultFieldValues
  }

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues
  });

  const { setValue, getValues } = form;

  const title = (() => {
    if (!attestation) {
      return 'Make attestation'
    } else {
      const uid = truncateEllipsis(attestation.uid, 13);
      return `Attestation ${uid} ${attestation.revoked ? '(revoked)' : ''}`
    }
  })();

  return (
    <>
      <h1 className="text-3xl font-bold">{title}</h1>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit.bind(null, parsedSchema))} className="w-full space-y-6">
          <FormField
            control={form.control}
            name="recipient"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Recipient</FormLabel>
                <FormControl>
                  <Input
                    readOnly={readOnly}
                    placeholder="Ex. vitalik.eth or 0x0000000000000000000000000000000000000000" {...field} />
                </FormControl>
                <FormDescription>
                  Optional address or ENS name of the recipient.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )} />
          {parsedSchema.fields.length > 0 && (
            <FormFieldsFromSchema ro={readOnly} schema={parsedSchema} form={form} />
          )}
          <Collapsible
            open={advancedOptionsOpen}
            onOpenChange={setAdvancedOptionsOpen}
          >
            <CollapsibleTrigger asChild>
              <div className="grid grid-cols-1">
                <Button type="button" variant="secondary">
                  <span className="text-sm font-semibold mx-5">
                    Advanced options
                  </span>
                  {advancedOptionsOpen ?
                    <Minus className="h-4 w-4" /> :
                    <Plus className="h-4 w-4" />}
                </Button>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2">
              <FormField
                control={form.control}
                name="referencedAttestation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Referenced Attestation UID (optional)</FormLabel>
                    <FormControl>
                      <Input
                        readOnly={readOnly}
                        placeholder="ex: 0x0000000000000000000000000000000000000000000000000000000000000000" {...field} />
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
                      <Switch
                        id="revocable" checked={getValues().revocable}
                        onClick={_ => readOnly ? null : setValue('revocable', !getValues().revocable)} />
                    </FormControl>
                  </FormItem>
                )} />
            </CollapsibleContent>
          </Collapsible>
          <div className="grid grid-cols-1">
            {readOnly ?
              (!attestation.revoked ?
                <Button type="submit" variant="destructive" className="col-span-1">Revoke attestation</Button> : <></>) :
              <Button type="submit" className="col-span-1">Make attestation</Button>}
          </div>
        </form>
      </Form>
    </>
  );
}
