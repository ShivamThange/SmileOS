import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fmtDate } from "@/lib/format";
import type { RecallType as ApiRecallType } from "@/shared/enums";
import { listRecalls, listReviews } from "./api";
import type { Recall, RecallType, Review } from "./growth-data";

/*
 * Growth hooks (T2.6 / T3.4). Recalls and reviews mapped from their backends
 * into the shapes the screens already render.
 */

const RECALL_TYPE_DISPLAY: Record<ApiRecallType, RecallType> = {
  hygiene: "Hygiene",
  implant_review: "Implant review",
  ortho: "Ortho",
  post_op: "Post-op",
  denture_review: "Post-op",
  custom: "Hygiene",
};

export function useRecalls() {
  return useQuery({
    queryKey: queryKeys.recalls.list(),
    queryFn: async (): Promise<Recall[]> => {
      const { data } = await listRecalls();
      return data.map((r) => {
        const overdueDays = Math.max(0, Math.floor((Date.now() - new Date(r.dueDate).getTime()) / 86_400_000));
        return {
          id: r._id,
          patientId: r.patient?._id ?? "",
          patient: r.patient ? [r.patient.firstName, r.patient.lastName].filter(Boolean).join(" ") : "—",
          type: RECALL_TYPE_DISPLAY[r.type] ?? "Hygiene",
          due: fmtDate(r.dueDate),
          overdueDays,
          phone: r.patient?.phone ?? "",
          lastVisit: r.patient?.lastVisit ? fmtDate(r.patient.lastVisit) : "—",
        };
      });
    },
    staleTime: 60_000,
  });
}

export function useReviews() {
  return useQuery({
    queryKey: queryKeys.reviews.list(),
    queryFn: async (): Promise<Review[]> => {
      const { data } = await listReviews();
      return data.map((r) => {
        const rating = r.internalRating ?? 0;
        const onGoogle = r.routedToPublic || r.responseStatus === "public";
        const routed: Review["routed"] =
          onGoogle ? "google" : r.responseStatus === "recovery" || r.responseStatus === "resolved" ? "recovery" : "pending";
        return {
          id: r._id,
          patient: r.patient ? `${r.patient.firstName ?? ""} ${(r.patient.lastName ?? "").slice(0, 1)}.`.trim() : "Patient",
          rating,
          channel: onGoogle ? "Google" : "Private",
          text: r.internalFeedback ?? "",
          when: fmtDate(r.createdAt),
          routed,
        };
      });
    },
    staleTime: 60_000,
  });
}
