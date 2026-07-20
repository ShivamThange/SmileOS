import type {
  Appointment,
  Lead,
  Patient,
  RecoveryRow,
  WaitlistEntry,
} from "@/types";

/*
 * Seed data ported verbatim from the Claude Design project so the Console
 * demos exactly as designed. Money is stored in paise (rupees × 100) to
 * match the backend contract; formatters convert at the display layer.
 */
const R = (rupees: number) => rupees * 100;

export const patients: Patient[] = [
  { id: "p1", name: "Ramesh Iyer", pno: "MDC-0412", agesex: "52 M", phone: "98220 44513", balancePaise: R(12500), ltvPaise: R(148000), alert: "Allergy: Penicillin · Type 2 diabetes", lastVisit: "12 Jun 2026", nextVisit: "None booked", timeline: [{ date: "12 Jun", text: "Full-mouth rehabilitation planned — ₹1,85,000, deferred" }, { date: "12 Jun", text: "OPG taken; generalised attrition noted" }, { date: "3 Feb", text: "Crown cemented on 46 · paid ₹9,500" }] },
  { id: "p2", name: "Sunita Deshmukh", pno: "MDC-1038", agesex: "44 F", phone: "99700 21837", balancePaise: 0, ltvPaise: R(62400), alert: "", lastVisit: "24 Jun 2026", nextVisit: "None booked", timeline: [{ date: "24 Jun", text: "Implant + crown on 36 planned — ₹48,500, deferred" }, { date: "24 Jun", text: "CBCT reviewed; bone adequate" }, { date: "10 Jan", text: "Scaling and polishing · paid ₹1,800" }] },
  { id: "p3", name: "Farhan Shaikh", pno: "MDC-0871", agesex: "31 M", phone: "98500 77281", balancePaise: R(4000), ltvPaise: R(21500), alert: "", lastVisit: "26 Jun 2026", nextVisit: "None booked", timeline: [{ date: "26 Jun", text: "Veneers 13–23 quoted — ₹72,000, comparing clinics" }, { date: "26 Jun", text: "Shade photos taken" }] },
  { id: "p4", name: "Priya Nair", pno: "MDC-1204", agesex: "29 F", phone: "97640 11922", balancePaise: 0, ltvPaise: R(8200), alert: "", lastVisit: "8 Jul 2026", nextVisit: "None booked", timeline: [{ date: "8 Jul", text: "38 extraction advised — pericoronitis history" }, { date: "8 Jul", text: "IOPA of 38 taken" }] },
  { id: "p5", name: "Vikram Sathe", pno: "MDC-0655", agesex: "61 M", phone: "98811 30456", balancePaise: R(2000), ltvPaise: R(94600), alert: "Allergy: Sulpha drugs · Hypertension", lastVisit: "30 Jun 2026", nextVisit: "None booked", timeline: [{ date: "30 Jun", text: "RCT + crown on 46 planned — ₹32,000, deferred" }, { date: "14 Jul", text: "Follow-up call — will discuss with son" }] },
  { id: "p6", name: "Asha Kulkarni", pno: "MDC-0233", agesex: "38 F", phone: "98903 55671", balancePaise: 0, ltvPaise: R(33800), alert: "", lastVisit: "5 Jul 2026", nextVisit: "Today · 11:30", timeline: [{ date: "5 Jul", text: "Crown on 16 advised — travelling till month end" }, { date: "5 Jul", text: "Cracked amalgam noted on 16" }] },
  { id: "p7", name: "Dinesh Choudhary", pno: "MDC-0980", agesex: "47 M", phone: "99230 84315", balancePaise: 0, ltvPaise: R(41200), alert: "", lastVisit: "2 Jul 2026", nextVisit: "None booked", timeline: [{ date: "15 Jul", text: "Sent EMI options on WhatsApp" }, { date: "2 Jul", text: "21 fractured at gumline; implant feasible" }] },
  { id: "p8", name: "Meena Joshi", pno: "MDC-1150", agesex: "55 F", phone: "98607 42280", balancePaise: 0, ltvPaise: R(27900), alert: "Hypothyroid — on medication", lastVisit: "18 Jun 2026", nextVisit: "None booked", timeline: [{ date: "18 Jun", text: "Upper complete denture planned — ₹24,000" }, { date: "18 Jun", text: "Existing denture 9 yrs old, poor fit" }] },
  { id: "p9", name: "Arjun Bhosale", pno: "MDC-0777", agesex: "24 M", phone: "97300 19684", balancePaise: 0, ltvPaise: R(4600), alert: "", lastVisit: "10 Jul 2026", nextVisit: "None booked", timeline: [{ date: "10 Jul", text: "Scaling + two composites advised — said he'd book online" }] },
];

export const leads: Lead[] = [
  { id: "L1", name: "Vaibhav Rao", phone: "98765 11223", source: "Google", interest: "Dental implants", valuePaise: R(84000), age: "2h ago", stage: "new", followUp: "Call today" },
  { id: "L2", name: "Anita Khanna", phone: "99871 44556", source: "Instagram", interest: "Clear aligners", valuePaise: R(120000), age: "5h ago", stage: "new", followUp: "Call today" },
  { id: "L3", name: "Sameer Bhatt", phone: "97654 88990", source: "Referral", interest: "Smile makeover", valuePaise: R(96000), age: "1d ago", stage: "contacted", followUp: "Send quote" },
  { id: "L4", name: "Deepika Menon", phone: "98220 33445", source: "Google", interest: "Full-mouth rehab", valuePaise: R(210000), age: "2d ago", stage: "contacted", followUp: "Follow up 22 Jul" },
  { id: "L5", name: "Rohan Gupta", phone: "99870 22110", source: "Walk-in", interest: "Root canal + crown", valuePaise: R(32000), age: "2d ago", stage: "consult", followUp: "Consult booked 21 Jul" },
  { id: "L6", name: "Fatima Sheikh", phone: "97650 66778", source: "Google", interest: "Braces", valuePaise: R(55000), age: "3d ago", stage: "consult", followUp: "Consult booked 23 Jul" },
  { id: "L7", name: "Kiran Patwardhan", phone: "98905 77889", source: "Referral", interest: "2 implants", valuePaise: R(88000), age: "4d ago", stage: "won", followUp: "Converted" },
  { id: "L8", name: "Nikhil Verma", phone: "99871 90011", source: "Instagram", interest: "Whitening", valuePaise: R(12000), age: "5d ago", stage: "lost", followUp: "Went elsewhere — price" },
];

export const appointments: Appointment[] = [
  { id: "a1", chair: "Chair 1", doctor: "Dr. Kulkarni", name: "Sanjay Kale", agesex: "41 M", proc: "Scaling & polish", start: 9, dur: 0.5, status: "done", flags: ["rem"] },
  { id: "a2", chair: "Chair 1", doctor: "Dr. Kulkarni", name: "Neha Gokhale", agesex: "27 F", proc: "RCT 25 · visit 2 of 3", start: 9.5, dur: 1, status: "done", flags: [] },
  { id: "a3", chair: "Chair 1", doctor: "Dr. Kulkarni", name: "Rohit Deshpande", agesex: "36 M", proc: "RCT 46 · visit 1", start: 11.25, dur: 1, status: "inchair", flags: ["due"] },
  { id: "a4", chair: "Chair 1", doctor: "Dr. Kulkarni", name: "Imran Sayyed", agesex: "48 M", proc: "Crown prep 17", start: 14, dur: 1, status: "confirmed", flags: ["rem"] },
  { id: "a5", chair: "Chair 1", doctor: "Dr. Kulkarni", name: "Pooja Shinde", agesex: "22 F", proc: "Composite 11", start: 16, dur: 0.5, status: "booked", flags: ["new", "lead"] },
  { id: "a6", chair: "Chair 2", doctor: "Dr. Meher", name: "Suresh Wagh", agesex: "63 M", proc: "Denture trial", start: 9.5, dur: 0.75, status: "done", flags: [] },
  { id: "a7", chair: "Chair 2", doctor: "Dr. Meher", name: "Kunal Barve", agesex: "33 M", proc: "Implant review 36", start: 10.5, dur: 0.75, status: "noshow", flags: ["rem"] },
  { id: "a8", chair: "Chair 2", doctor: "Dr. Meher", name: "Asha Kulkarni", agesex: "38 F", proc: "Crown prep 16", start: 11.5, dur: 1, status: "inchair", flags: [] },
  { id: "a9", chair: "Chair 2", doctor: "Dr. Meher", name: "Sunil Pawar", agesex: "58 M", proc: "Implant placement 46", start: 14.5, dur: 1.5, status: "confirmed", flags: ["consent", "due"] },
  { id: "a10", chair: "Chair 2", doctor: "Dr. Meher", name: "Deepa Marathe", agesex: "45 F", proc: "RCT 15 · visit 1", start: 17, dur: 0.75, status: "booked", flags: [] },
  { id: "a11", chair: "Chair 3", doctor: "Dr. Patil", name: "Tanvi Karnik", agesex: "14 F", proc: "Braces adjustment", start: 10, dur: 1, status: "done", flags: [] },
  { id: "a12", chair: "Chair 3", doctor: "Dr. Patil", name: "Kavita Rane", agesex: "31 F", proc: "Aligner scan", start: 11.75, dur: 0.5, status: "arrived", flags: ["rem"] },
  { id: "a13", chair: "Chair 3", doctor: "Dr. Patil", name: "Aarav Jadhav", agesex: "12 M", proc: "Braces adjustment", start: 14, dur: 0.75, status: "confirmed", flags: ["rem"] },
  { id: "a14", chair: "Chair 3", doctor: "Dr. Patil", name: "Shreya Kadam", agesex: "26 F", proc: "Whitening consult", start: 15.5, dur: 0.75, status: "booked", flags: ["new"] },
  { id: "a15", chair: "Chair 3", doctor: "Dr. Patil", name: "Manish Thorat", agesex: "35 M", proc: "Aligner check", start: 18, dur: 0.5, status: "cancelled", flags: [] },
  { id: "a16", chair: "Chair 4", doctor: "Dr. Kulkarni", name: "Leela Bhat", agesex: "67 F", proc: "Denture adjustment", start: 9.25, dur: 0.5, status: "done", flags: [] },
  { id: "a17", chair: "Chair 4", doctor: "Dr. Meher", name: "Ganesh More", agesex: "52 M", proc: "Extraction 38", start: 12, dur: 0.75, status: "confirmed", flags: ["due"] },
  { id: "a18", chair: "Chair 4", doctor: "Dr. Patil", name: "Ritika Sen", agesex: "29 F", proc: "Scaling & polish", start: 15, dur: 0.5, status: "booked", flags: ["new"] },
  { id: "a19", chair: "Chair 4", doctor: "Dr. Kulkarni", name: "Prakash Joshi", agesex: "44 M", proc: "Scaling & polish", start: 17.5, dur: 0.75, status: "booked", flags: ["rem"] },
];

export const recoveryRows: RecoveryRow[] = [
  { id: "r1", patientId: "p2", proc: "Implant + zirconia crown", tooth: "Tooth 36 (FDI)", type: "Implants", valuePaise: R(48500), planned: "24 Jun", ago: "26 days ago", urgency: "High", doctor: "Dr. Meher", lastContact: "10 Jul — no answer", lastSub: "2nd attempt", due: "today", finding: "36 missing 8 months; adjacent 35 tilting mesially. Bone volume adequate on CBCT — window for a straightforward placement is closing.", reason: "Wanted to time it with her insurance year." },
  { id: "r2", patientId: "p5", proc: "Root canal + PFM crown", tooth: "Tooth 46 (FDI)", type: "Endo", valuePaise: R(32000), planned: "30 Jun", ago: "20 days ago", urgency: "High", doctor: "Dr. Kulkarni", lastContact: "14 Jul — spoke", lastSub: "Will discuss with son", due: "today", finding: "Deep caries on 46 approaching pulp, symptomatic to cold. Delay risks acute pulpitis and an emergency visit.", reason: "Anxious about the procedure; asked whether sedation is possible." },
  { id: "r3", patientId: "p8", proc: "Complete denture (upper)", tooth: "Upper arch", type: "Prostho", valuePaise: R(24000), planned: "18 Jun", ago: "32 days ago", urgency: "Moderate", doctor: "Dr. Meher", lastContact: "Never contacted", lastSub: "", due: "today", finding: "Upper arch edentulous; existing denture 9 years old with poor fit and midline crack. Diet already restricted.", reason: "Waiting for her daughter's wedding to pass." },
  { id: "r4", patientId: "p1", proc: "Full-mouth rehabilitation", tooth: "Multiple", type: "Prostho", valuePaise: R(185000), planned: "12 Jun", ago: "38 days ago", urgency: "High", doctor: "Dr. Meher", lastContact: "8 Jul — spoke", lastSub: "Call after salary week", due: "overdue", dueText: "Overdue · 2 days", finding: "Generalised attrition with multiple failing restorations and loss of vertical dimension. Staged plan across 6 visits.", reason: "Cash flow — asked us to call back after salary week." },
  { id: "r5", patientId: "p3", proc: "Veneers ×6 (E-max)", tooth: "13–23", type: "Cosmetic", valuePaise: R(72000), planned: "26 Jun", ago: "24 days ago", urgency: "Routine", doctor: "Dr. Patil", lastContact: "12 Jul — spoke", lastSub: "Comparing clinics", due: "22 Jul", finding: "Fluorosis staining on 13–23; patient wants a whiter, even smile for his engagement in September.", reason: "Comparing price with a clinic in Koregaon Park." },
  { id: "r6", patientId: "p7", proc: "Single implant", tooth: "Tooth 21 (FDI)", type: "Implants", valuePaise: R(42000), planned: "2 Jul", ago: "18 days ago", urgency: "Moderate", doctor: "Dr. Meher", lastContact: "15 Jul — WhatsApp", lastSub: "Wants EMI details", due: "21 Jul", finding: "21 fractured at gumline after a fall; socket healing well. Immediate implant feasible if placed within 4–6 weeks.", reason: "Wants a written EMI plan before committing." },
  { id: "r7", patientId: "p4", proc: "Wisdom tooth extraction", tooth: "Tooth 38 (FDI)", type: "Surgery", valuePaise: R(8500), planned: "8 Jul", ago: "12 days ago", urgency: "High", doctor: "Dr. Kulkarni", lastContact: "Never contacted", lastSub: "", due: "23 Jul", finding: "38 mesioangular impaction with a pericoronitis episode last month. Next flare-up will be worse.", reason: "Scared of the extraction; asked how painful it is." },
  { id: "r8", patientId: "p6", proc: "Zirconia crown", tooth: "Tooth 16 (FDI)", type: "Endo", valuePaise: R(14500), planned: "5 Jul", ago: "15 days ago", urgency: "Routine", doctor: "Dr. Meher", lastContact: "11 Jul — spoke", lastSub: "Travelling till month end", due: "30 Jul", finding: "Cracked amalgam on 16 with cusp-fracture risk under load.", reason: "Travelling for work until the end of the month." },
  { id: "r9", patientId: "p9", proc: "Scaling + composite ×2", tooth: "24, 25", type: "Endo", valuePaise: R(6800), planned: "10 Jul", ago: "10 days ago", urgency: "Routine", doctor: "Dr. Patil", lastContact: "Never contacted", lastSub: "", due: "24 Jul", finding: "Generalised calculus; incipient caries on 24 and 25 — cheap to fix now, expensive later.", reason: "Said he would book online later." },
];

export const waitlist: WaitlistEntry[] = [
  { name: "Nilesh Gaikwad", want: "RCT 36 · any weekday morning", since: "Waiting 4 days" },
  { name: "Sushma Patwardhan", want: "Crown cementation · prefers Dr. Meher", since: "Waiting 2 days" },
  { name: "Rahul Khare", want: "Extraction 48 · in pain, wants earliest", since: "Added today" },
];

/** Daily collections for the last 30 days, in ₹ thousands (0 = Sunday, closed). */
export const collections30 = [
  28, 34, 22, 41, 38, 12, 0, 31, 45, 29, 36, 52, 18, 0, 44, 39, 27, 58, 33, 21, 0,
  42, 36, 49, 31, 26, 14, 0, 47, 42,
];

export const chairSubs: Record<string, string> = {
  "Chair 1": "Dr. Kulkarni",
  "Chair 2": "Dr. Meher",
  "Chair 3": "Dr. Patil",
  "Chair 4": "Shared · hygiene",
};

export const doctorSubs: Record<string, string> = {
  "Dr. Meher": "Prosthodontist",
  "Dr. Kulkarni": "Endodontist",
  "Dr. Patil": "Orthodontist",
};
