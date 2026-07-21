import { Schema, model } from "mongoose";

/*
 * Counter — backs sequential, human-readable numbers per clinic (patient
 * number, invoice number). Incremented atomically via findOneAndUpdate with
 * $inc + upsert so concurrent creates never collide (spec 2.2 / 2.6).
 */

const counterSchema = new Schema({
  clinicId: { type: Schema.Types.ObjectId, required: true },
  key: { type: String, required: true }, // e.g. "patient", "invoice:2026"
  seq: { type: Number, default: 0 },
});
counterSchema.index({ clinicId: 1, key: 1 }, { unique: true });

export const CounterModel = model("Counter", counterSchema);

/** Atomically allocate the next sequence value for a clinic+key. */
export async function nextSeq(clinicId: unknown, key: string): Promise<number> {
  const doc = await CounterModel.findOneAndUpdate(
    { clinicId, key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean();
  return doc!.seq;
}
