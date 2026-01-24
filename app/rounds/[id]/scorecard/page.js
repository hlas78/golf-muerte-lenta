"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ScorecardRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.id) {
      router.replace(`/rounds/${params.id}`);
    }
  }, [params, router]);

  return null;
}
