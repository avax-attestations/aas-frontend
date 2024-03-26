

export type SchemaFieldsCardProps = {
  schema: string
}

function SchemaFieldCard({ fieldSchema }: { fieldSchema: string }) {
  const [fieldName, fieldType] = fieldSchema.split(/\s+/)
  return (<div className="flex flex-col bg-gray-100 border rounded-sm border-gray-400 my-1 mx-1 px-2 py-1 font-mono">
    <span className="text-gray-500 text-xs">{fieldName}</span>
    <span className="text-gray-800 font-semibold text-sm">{fieldType}</span>
  </div>);
}

export function SchemaFieldsCard({ schema }: SchemaFieldsCardProps) {
  const fields = schema.split(/\s*,\s*/)
  return (<div className="flex flex-wrap">
    {fields.map((f, i) => <SchemaFieldCard key={i} fieldSchema={f} />)}
  </div>);
}
