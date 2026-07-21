/*
 * Seed source data — realistic but invented Indian names, Pune-plausible, and
 * a procedure price book. Kept separate from the seed runner so the runner
 * stays readable.
 */

export const FIRST_NAMES_M = ["Ramesh", "Amit", "Vikram", "Sanjay", "Rohit", "Imran", "Suresh", "Kunal", "Sunil", "Ganesh", "Mahesh", "Kiran", "Rahul", "Nikhil", "Prakash", "Dinesh", "Arjun", "Aarav", "Sameer", "Vaibhav"];
export const FIRST_NAMES_F = ["Sunita", "Priya", "Asha", "Meena", "Preeti", "Deepa", "Neha", "Anita", "Kavita", "Shreya", "Ritika", "Sneha", "Pooja", "Fatima", "Manisha", "Reena", "Tanvi", "Leela", "Sushma", "Deepika"];
export const LAST_NAMES = ["Iyer", "Deshmukh", "Kulkarni", "Nair", "Sathe", "Joshi", "Choudhary", "Bhosale", "Rao", "Patil", "Shinde", "Gokhale", "Bhat", "Kadam", "Menon", "Sheikh", "Wagh", "Pawar", "Marathe", "Thorat"];
export const LOCALITIES = ["Aundh", "Baner", "Wakad", "Pashan", "Bavdhan", "Balewadi", "Kothrud", "Hinjewadi"];

export const PROCEDURES = [
  { code: "CONSULT", name: "Consultation", friendlyName: "Consultation", category: "preventive", price: 500, recall: 180, publicVisible: true, order: 1 },
  { code: "SCALE", name: "Scaling & polishing", friendlyName: "Cleaning & polishing", category: "preventive", price: 1200, recall: 180, publicVisible: true, order: 2 },
  { code: "COMP", name: "Composite filling", friendlyName: "Tooth-coloured filling", category: "restorative", price: 2000, toothSpecific: true, surfaceSpecific: true, order: 3 },
  { code: "RCT-A", name: "Root canal (anterior)", friendlyName: "Root canal", category: "endodontic", price: 6500, toothSpecific: true, order: 4 },
  { code: "RCT-M", name: "Root canal (molar)", friendlyName: "Root canal", category: "endodontic", price: 8500, toothSpecific: true, publicVisible: true, order: 5 },
  { code: "CROWN-PFM", name: "PFM crown", friendlyName: "Metal-ceramic cap", category: "prosthodontic", price: 9500, toothSpecific: true, requiresLab: true, order: 6 },
  { code: "CROWN-ZIR", name: "Zirconia crown", friendlyName: "Zirconia cap", category: "prosthodontic", price: 12000, toothSpecific: true, requiresLab: true, publicVisible: true, order: 7 },
  { code: "IMPLANT", name: "Single implant", friendlyName: "Dental implant", category: "implant", price: 42000, toothSpecific: true, requiresConsent: true, publicVisible: true, order: 8 },
  { code: "IMPLANT-CROWN", name: "Implant crown", friendlyName: "Cap on implant", category: "implant", price: 18000, toothSpecific: true, requiresLab: true, order: 9 },
  { code: "VENEER", name: "E-max veneer", friendlyName: "Veneer", category: "cosmetic", price: 14000, toothSpecific: true, requiresLab: true, publicVisible: true, order: 10 },
  { code: "EXTRACT", name: "Extraction", friendlyName: "Tooth removal", category: "oral_surgery", price: 1500, toothSpecific: true, order: 11 },
  { code: "EXTRACT-SURG", name: "Surgical extraction", friendlyName: "Surgical removal", category: "oral_surgery", price: 8500, toothSpecific: true, requiresConsent: true, order: 12 },
  { code: "ALIGNER", name: "Clear aligners (full)", friendlyName: "Clear aligners", category: "orthodontic", price: 148000, publicVisible: true, order: 13 },
  { code: "BRACES", name: "Metal braces", friendlyName: "Braces", category: "orthodontic", price: 45000, publicVisible: true, order: 14 },
  { code: "DENTURE-U", name: "Complete denture (upper)", friendlyName: "Denture", category: "prosthodontic", price: 24000, requiresLab: true, order: 15 },
  { code: "GUM", name: "Gum treatment", friendlyName: "Gum treatment", category: "periodontal", price: 4500, recall: 120, order: 16 },
];

export const DOCTORS = [
  { name: "Dr. Anjali Meher", email: "anjali@meherdental.in", speciality: "Prosthodontist", qualifications: ["BDS", "MDS"], years: 14, slug: "dr-anjali-meher" },
  { name: "Dr. Rohan Kulkarni", email: "rohan@meherdental.in", speciality: "Endodontist", qualifications: ["BDS", "MDS"], years: 9, slug: "dr-rohan-kulkarni" },
  { name: "Dr. Sneha Patil", email: "sneha@meherdental.in", speciality: "Orthodontist", qualifications: ["BDS", "MDS"], years: 7, slug: "dr-sneha-patil" },
];

export const ALLERGIES = ["Penicillin", "Sulpha drugs", "Latex", "Aspirin"];

export function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
export function chance(p: number): boolean { return Math.random() < p; }
export function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min; }
export function phone(): string { return `9${randInt(1, 9)}${randInt(100, 999)} ${randInt(10000, 99999)}`; }
export function daysAgo(n: number): Date { return new Date(Date.now() - n * 86400000); }
export function daysFromNow(n: number): Date { return new Date(Date.now() + n * 86400000); }
