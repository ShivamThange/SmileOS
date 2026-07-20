/*
 * Growth mock data — recalls due, the unified inbox, campaigns and reviews.
 * Money in paise where it appears. Kept realistic but invented.
 */

export type RecallType = "Hygiene" | "Implant review" | "Ortho" | "Post-op";
export interface Recall {
  id: string;
  patientId: string;
  patient: string;
  type: RecallType;
  due: string;
  overdueDays: number;
  phone: string;
  lastVisit: string;
}

export const recalls: Recall[] = [
  { id: "rc1", patientId: "p2", patient: "Sunita Deshmukh", type: "Implant review", due: "18 Jul", overdueDays: 2, phone: "98220 44513", lastVisit: "24 Jun" },
  { id: "rc2", patientId: "p7", patient: "Kiran Joshi", type: "Hygiene", due: "10 Jul", overdueDays: 10, phone: "98901 22334", lastVisit: "10 Jan" },
  { id: "rc3", patientId: "p4", patient: "Preeti Nair", type: "Ortho", due: "22 Jul", overdueDays: 0, phone: "99700 88123", lastVisit: "15 Jul" },
  { id: "rc4", patientId: "p8", patient: "Deepa Rao", type: "Hygiene", due: "2 Jun", overdueDays: 48, phone: "97654 33221", lastVisit: "2 Dec" },
  { id: "rc5", patientId: "p6", patient: "Fatima Sheikh", type: "Post-op", due: "21 Jul", overdueDays: 0, phone: "98111 55667", lastVisit: "28 Jun" },
  { id: "rc6", patientId: "p9", patient: "Mahesh Patil", type: "Hygiene", due: "5 Jul", overdueDays: 15, phone: "90280 11220", lastVisit: "5 Jan" },
];

export interface InboxMsg { from: "them" | "us"; text: string; time: string; }
export interface Conversation {
  id: string;
  patientId: string;
  name: string;
  channel: "WhatsApp" | "SMS" | "Email";
  preview: string;
  time: string;
  unread: number;
  phone: string;
  tag?: string;
  messages: InboxMsg[];
}

export const conversations: Conversation[] = [
  {
    id: "cv1", patientId: "p2", name: "Sunita Deshmukh", channel: "WhatsApp", preview: "Thank you! See you Thursday.", time: "10:32", unread: 0, phone: "98220 44513", tag: "Implant",
    messages: [
      { from: "us", text: "Hi Sunita, a reminder your implant review is on Thursday 23 July at 5:30 pm with Dr. Meher.", time: "Yesterday 09:10" },
      { from: "them", text: "Got it. Do I need to bring the old X-rays?", time: "Yesterday 18:44" },
      { from: "us", text: "No need — we have them on file. Just come 10 minutes early.", time: "Today 10:30" },
      { from: "them", text: "Thank you! See you Thursday.", time: "Today 10:32" },
    ],
  },
  {
    id: "cv2", patientId: "p10", name: "Rahul Bhat", channel: "WhatsApp", preview: "What would a single implant cost?", time: "09:58", unread: 2, phone: "98333 77441", tag: "Lead",
    messages: [
      { from: "them", text: "Hi, I saw your website. What would a single implant cost?", time: "Today 09:55" },
      { from: "them", text: "And do you do EMI?", time: "Today 09:58" },
    ],
  },
  {
    id: "cv3", patientId: "p3", name: "Amit Kulkarni", channel: "SMS", preview: "Payment link please", time: "Yesterday", unread: 1, phone: "99001 22110",
    messages: [
      { from: "them", text: "Can you send the payment link for the root canal bill?", time: "Yesterday 16:20" },
    ],
  },
  {
    id: "cv4", patientId: "p11", name: "Neha Kapoor", channel: "Email", preview: "Re: your appointment reminder", time: "Mon", unread: 0, phone: "—",
    messages: [
      { from: "us", text: "Reminder: cleaning on Monday 21 July at 11 am.", time: "Sat 12:00" },
      { from: "them", text: "Can we move it to the afternoon?", time: "Mon 08:15" },
    ],
  },
];

export type CampaignStatus = "active" | "scheduled" | "done";
export interface Campaign {
  id: string;
  name: string;
  kind: "Recall" | "Reactivation" | "Recovery" | "Promotional";
  status: CampaignStatus;
  sent: number;
  replied: number;
  booked: number;
  revenuePaise: number;
}

export const campaigns: Campaign[] = [
  { id: "cp1", name: "6-month hygiene recall", kind: "Recall", status: "active", sent: 84, replied: 31, booked: 19, revenuePaise: 3800000 },
  { id: "cp2", name: "Lapsed patients — win back", kind: "Reactivation", status: "active", sent: 120, replied: 22, booked: 9, revenuePaise: 5400000 },
  { id: "cp3", name: "Unscheduled treatment recovery", kind: "Recovery", status: "active", sent: 46, replied: 18, booked: 12, revenuePaise: 9200000 },
  { id: "cp4", name: "Monsoon whitening offer", kind: "Promotional", status: "scheduled", sent: 0, replied: 0, booked: 0, revenuePaise: 0 },
  { id: "cp5", name: "Diwali smile makeover", kind: "Promotional", status: "done", sent: 210, replied: 44, booked: 16, revenuePaise: 12600000 },
];

export interface Review {
  id: string;
  patient: string;
  rating: number;
  channel: "Google" | "Private";
  text: string;
  when: string;
  routed: "google" | "recovery" | "pending";
}

export const reviews: Review[] = [
  { id: "rv1", patient: "Sunita D.", rating: 5, channel: "Google", text: "Painless implant, spotless clinic. Dr. Meher explained everything.", when: "2d ago", routed: "google" },
  { id: "rv2", patient: "Amit K.", rating: 5, channel: "Google", text: "They showed me the sterilised pack before opening. Trust earned.", when: "3w ago", routed: "google" },
  { id: "rv3", patient: "Vikram R.", rating: 2, channel: "Private", text: "Waited 40 minutes past my slot. Treatment was fine but the delay wasn't.", when: "5d ago", routed: "recovery" },
  { id: "rv4", patient: "Preeti N.", rating: 4, channel: "Private", text: "Good care, though parking was tricky.", when: "1w ago", routed: "pending" },
];

export function reviewStats() {
  const google = reviews.filter((r) => r.channel === "Google");
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / (reviews.length || 1);
  const caught = reviews.filter((r) => r.routed === "recovery").length;
  return { avg, googleCount: google.length, caught, total: reviews.length };
}
