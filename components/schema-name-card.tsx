export type SchemaNameCardProps = {
  name: string
}

export function SchemaNameCard({ name }: SchemaNameCardProps) {
  const namePieces = name.split(/\s+/)
  return (<div className="flex">
    <div className="flex space-x-1 items-center bg-yellow-100 border rounded-sm border-gray-400 px-1 font-serif">
      {namePieces.map((n, i) => <span key={i} className="text-gray-600 font-semibold text-sm">{n}</span>)}
    </div>
  </div>);
}
