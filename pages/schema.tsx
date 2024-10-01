import { useSearchParams } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { useDb } from "@/hooks/useDb";
import { SchemaView } from "@/components/schema-view";
import { useAttestationQuery } from "@/hooks/query/useAttestationQuery";
import { fetchSchema } from "@/lib/indexer/query";
import { useChain } from "@/hooks/useChain";
import { isChain } from "@/lib/config";
import { useEffect, useState } from "react";
import type { Schema } from "@/lib/db";

export default function SchemaPage() {
  const db = useDb();
  const searchParams = useSearchParams();
  const { client, chain, setChain } = useChain();
  const [schema, setSchema] = useState<Schema | null>(null);

  const uid = searchParams.get('uid');
  const queryParamsChain = searchParams.get('chain');
  const localSchema = useLiveQuery(
    () => db.schemas.where('uid').equals(uid ?? '').first(),
    [db, uid]);

  useEffect(() => {
    if (queryParamsChain && chain !== queryParamsChain && isChain(queryParamsChain)) {
      setChain(queryParamsChain);
    }
  }, [queryParamsChain, chain, setChain]);

  useEffect(() => {
    if (localSchema) {
      setSchema(localSchema);
      return
    }

    if (!client || !db || !uid) {
      return;
    }

    fetchSchema(client, uid).then((schema) => {
      setSchema(schema);
    });

  }, [localSchema, client, db, uid])

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
