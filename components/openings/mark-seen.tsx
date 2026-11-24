"use client";

import { useEffect } from "react";
import { useCurrentUser } from "@/components/providers/current-user-provider";
import { markOpeningsSeen } from "@/lib/actions/community";
import { tourActive } from "@/lib/tours/active";

/** Records that the student opened Openings (or one category) after it rendered: the new dots and the nav badge. */
export function MarkOpeningsSeen({ category }: { category: string }) {
  const userId = useCurrentUser()?.id ?? "";
  useEffect(() => {
    // The guided tour walks through here: that visit isn't the student reading their openings.
    if (userId && tourActive(userId)) return;
    void markOpeningsSeen({ category });
  }, [category, userId]);
  return null;
}
