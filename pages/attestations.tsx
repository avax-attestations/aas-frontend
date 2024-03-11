import { useSearchParams } from "next/navigation";
import { Attestations } from "@/components/attestations";
import { useAttestationQuery } from "@/hooks/useAttestationQuery";

export default function AttestationsPage() {
  const searchParams = useSearchParams();

  const pageSize = 20;

  const {
    attestations,
    schemas,
    totalRecords,
  } = useAttestationQuery({
    searchParams,
    pageSize
  });

  return (
    <Attestations
      attestations={attestations}
      schemas={schemas}
      searchParams={searchParams}
      totalRecords={totalRecords}
      pageSize={pageSize}
    />
  );
};
