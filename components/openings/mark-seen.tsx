"use client";

import { useEffect } from "react";
import { markOpeningsSeen } from "@/lib/actions/community";

/** Records that the student opened Openings (or one category) after it rendered: the new dots and the nav badge. */
export function MarkOpeningsSeen({ category }: { category: string }) {
  useEffect(() => {
    void markOpeningsSeen({ category });
  }, [category]);
  return null;
}
