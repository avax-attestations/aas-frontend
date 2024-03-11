import { useSearchParams } from "next/navigation";
import { Attestations } from "@/components/attestations";
import { useAttestationQuery } from "@/hooks/query/useAttestationQuery";

export default function AttestationsPage() {
  const searchParams = useSearchParams();

  const pageSize = 20;

  const {
    attestations,
    totalRecords,
  } = useAttestationQuery({
    searchParams,
    pageSize
  });

  return (
    <Attestations
      attestations={attestations}
      searchParams={searchParams}
      totalRecords={totalRecords}
      pageSize={pageSize}
    />
  );
};
