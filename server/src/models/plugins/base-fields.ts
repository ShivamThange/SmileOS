import { Schema, Types } from "mongoose";

/*
 * Base fields plugin (spec 2 preamble + Part 0 rule 5). Every collection gets
 * clinicId, created/updated actor refs, timestamps, and soft-delete fields. The
 * default query scope excludes deleted documents; pass { withDeleted: true } in
 * query options to include them (used by restore/audit paths only).
 */

export interface BaseFields {
  clinicId: Types.ObjectId;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export function baseFieldsPlugin(schema: Schema, opts: { tenantScoped?: boolean } = {}): void {
  const tenantScoped = opts.tenantScoped !== false;

  schema.add({
    ...(tenantScoped ? { clinicId: { type: Schema.Types.ObjectId, ref: "Clinic", required: true, index: true } } : {}),
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
  });

  // createdAt / updatedAt
  schema.set("timestamps", true);

  // Default scope: hide soft-deleted docs unless explicitly asked for.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function scopeDeleted(this: any, next: () => void) {
    if (!this.getOptions().withDeleted) {
      const filter = this.getFilter();
      if (filter.isDeleted === undefined) filter.isDeleted = false;
    }
    next();
  }
  schema.pre("find", scopeDeleted);
  schema.pre("findOne", scopeDeleted);
  schema.pre("findOneAndUpdate", scopeDeleted);
  schema.pre("countDocuments", scopeDeleted);

  // Soft delete helper on documents.
  schema.methods.softDelete = function (byUserId?: Types.ObjectId) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    if (byUserId) this.deletedBy = byUserId;
    return this.save();
  };
}
