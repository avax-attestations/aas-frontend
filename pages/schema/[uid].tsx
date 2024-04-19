import { useRouter } from "next/router";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { SchemaView } from "@/components/schema-view";
import { useAttestationQuery } from "@/hooks/query/useAttestationQuery";

export default function SchemaPage() {
  const db = useDb();
  const router = useRouter();

  const uid = router.query['uid'];
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
