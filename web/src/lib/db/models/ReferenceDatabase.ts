import mongoose, { Schema, Document } from "mongoose";

export interface IReferenceDatabase extends Document {
  name: string;
  slug: string;
  source: "jaspar" | "custom";
  description: string;
  jasparCollection: string | null;
  lastSyncedAt: Date | null;
  motifCount: number;
  taxonGroups: string[];
  transfacFileKey: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReferenceDatabaseSchema = new Schema<IReferenceDatabase>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    source: { type: String, required: true, enum: ["jaspar", "custom"] },
    description: { type: String, default: "" },
    jasparCollection: { type: String, default: null },
    lastSyncedAt: { type: Date, default: null },
    motifCount: { type: Number, default: 0 },
    taxonGroups: [String],
    transfacFileKey: { type: String, default: null },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const ReferenceDatabase =
  mongoose.models.ReferenceDatabase ||
  mongoose.model<IReferenceDatabase>("ReferenceDatabase", ReferenceDatabaseSchema);
