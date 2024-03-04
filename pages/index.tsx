import { useRouter } from "next/router";
import { useEffect } from "react";

export default function HomeNextPage() {
  const { push } = useRouter()

  useEffect(() => {
    push('/attestations');
  }, [push])

  return (
    <h1 className="text-3xl font-bold">Home</h1>
  );
};
