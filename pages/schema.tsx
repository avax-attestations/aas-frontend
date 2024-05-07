import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { SchemaView } from "@/components/schema-view";
import { useAttestationQuery } from "@/hooks/query/useAttestationQuery";

export default function SchemaPage() {
  const db = useDb();
  const searchParams = useSearchParams();

  const uid = searchParams.get('uid');
  const schema = useLiveQuery(
    () => db.schemas.where('uid').equals(uid ?? '').first(),
    [db, uid]);

  const {
    attestations
  } = useAttestationQuery({
    pageSize: 5,
    schemaUid: (uid ?? '').toString()
  });

  return schema ? (
    <SchemaView
      schema={schema}
      latestAttestations={attestations}
    />
  ) : (
    <div>Loading...</div>
  )
}
