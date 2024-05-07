import { FIELD_REGEX, type FieldType } from "@/lib/field-types";

export type ParsedSchemaField = {
  type: FieldType
  name: string
  isArray: boolean
}

export type ParsedSchema = {
  fields: ParsedSchemaField[]
}

export function parseSchema(schema: string): ParsedSchema | null {
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

