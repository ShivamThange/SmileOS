/*
 * Team mock data — staff roster, permissions and today's attendance.
 */

export type StaffRole = "Doctor" | "Hygienist" | "Assistant" | "Front desk" | "Manager";
export interface Staff {
  id: string;
  name: string;
  role: StaffRole;
  speciality?: string;
  roster: string;
  permission: "Owner" | "Clinician" | "Reception" | "Read-only";
  active: boolean;
}

export const staff: Staff[] = [
  { id: "st1", name: "Dr. Anjali Meher", role: "Doctor", speciality: "Prosthodontist", roster: "Mon–Sat", permission: "Owner", active: true },
  { id: "st2", name: "Dr. Rohan Kulkarni", role: "Doctor", speciality: "Endodontist", roster: "Mon, Wed, Fri", permission: "Clinician", active: true },
  { id: "st3", name: "Dr. Sneha Patil", role: "Doctor", speciality: "Orthodontist", roster: "Tue, Thu, Sat", permission: "Clinician", active: true },
  { id: "st4", name: "Manisha Gokhale", role: "Hygienist", roster: "Mon–Fri", permission: "Clinician", active: true },
  { id: "st5", name: "Prakash Shinde", role: "Assistant", roster: "Mon–Sat", permission: "Read-only", active: true },
  { id: "st6", name: "Reena Fernandes", role: "Front desk", roster: "Mon–Sat", permission: "Reception", active: true },
  { id: "st7", name: "Sanjay Rao", role: "Manager", roster: "Mon–Fri", permission: "Owner", active: false },
];

export type AttendanceState = "in" | "out" | "absent" | "leave";
export interface Attendance {
  id: string;
  name: string;
  role: StaffRole;
  inTime: string;
  outTime: string;
  hours: string;
  state: AttendanceState;
}

export const ATTENDANCE_META: Record<AttendanceState, { label: string; bg: string; color: string; border: string }> = {
  in: { label: "In", bg: "#EAF1EE", color: "#20614E", border: "#C7DAD1" },
  out: { label: "Left", bg: "#F4F3EF", color: "#6E6C64", border: "#E6E4DE" },
  absent: { label: "Absent", bg: "#FBEFED", color: "#A8342A", border: "#EFC7C2" },
  leave: { label: "On leave", bg: "#FAF3E7", color: "#8A6B33", border: "#E5D2AC" },
};

export const attendance: Attendance[] = [
  { id: "at1", name: "Dr. Anjali Meher", role: "Doctor", inTime: "09:02", outTime: "—", hours: "4h 20m", state: "in" },
  { id: "at2", name: "Dr. Sneha Patil", role: "Doctor", inTime: "09:15", outTime: "—", hours: "4h 05m", state: "in" },
  { id: "at3", name: "Manisha Gokhale", role: "Hygienist", inTime: "08:55", outTime: "—", hours: "4h 27m", state: "in" },
  { id: "at4", name: "Prakash Shinde", role: "Assistant", inTime: "09:10", outTime: "13:00", hours: "3h 50m", state: "out" },
  { id: "at5", name: "Reena Fernandes", role: "Front desk", inTime: "08:45", outTime: "—", hours: "4h 37m", state: "in" },
  { id: "at6", name: "Dr. Rohan Kulkarni", role: "Doctor", inTime: "—", outTime: "—", hours: "—", state: "leave" },
];
