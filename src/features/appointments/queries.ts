import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  getCalendar,
  createAppointment,
  rescheduleAppointment,
  confirmAppointment,
  checkInAppointment,
  startAppointment,
  completeAppointment,
  cancelAppointment,
  noShowAppointment,
  type CreateAppointmentInput,
} from "./api";

/*
 * Appointment hooks (T2.3). The calendar is a single query keyed by its date
 * range; every mutation (create, reschedule, status transition) invalidates the
 * calendar so the grid re-reads the authoritative state — the server's conflict
 * engine and state machine are the source of truth, never optimistic guesses.
 */

export function useCalendar(from: Date, to: Date) {
  return useQuery({
    queryKey: queryKeys.appointments.calendar({ from: from.toISOString(), to: to.toISOString() }),
    queryFn: () => getCalendar(from, to),
    staleTime: 15_000,
  });
}

/** Invalidate every appointment-shaped query (calendar, today, queue). */
function useInvalidateAppointments() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.appointments.all });
}

/** Create. INVALIDATES: appointments.all — the new booking must appear. */
export function useCreateAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({ mutationFn: (input: CreateAppointmentInput) => createAppointment(input), onSuccess: invalidate });
}

/** Reschedule (move/resize). INVALIDATES: appointments.all. */
export function useRescheduleAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; start: string; end: string; operatory?: string; notify?: boolean }) =>
      rescheduleAppointment(id, body),
    onSuccess: invalidate,
  });
}

/** Status transitions. Each INVALIDATES appointments.all (calendar + queue). */
export function useAppointmentTransition() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "confirm" | "check-in" | "start" | "complete" | "cancel" | "no-show"; reason?: string }) => {
      switch (action) {
        case "confirm": return confirmAppointment(id);
        case "check-in": return checkInAppointment(id);
        case "start": return startAppointment(id);
        case "complete": return completeAppointment(id);
        case "cancel": return cancelAppointment(id, reason ?? "Cancelled");
        case "no-show": return noShowAppointment(id);
      }
    },
    onSuccess: invalidate,
  });
}
