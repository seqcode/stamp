import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMotif extends Document {
  databaseRef: Types.ObjectId;
  matrixId: string;
  baseId: string | null;
  version: number | null;
  name: string;
  dbSource: string;
  group: string;
  jasparCollection: string | null;
  taxGroup: string | null;
  tfClass: string | null;
  family: string | null;
  species: { taxId: number; name: string }[];
  pfm: { A: number[]; C: number[]; G: number[]; T: number[] };
  uniprotIds: string[];
  createdAt: Date;
}

const MotifSchema = new Schema<IMotif>(
  {
    databaseRef: { type: Schema.Types.ObjectId, ref: "ReferenceDatabase", required: true },
    matrixId: { type: String, required: true, index: true },
    baseId: { type: String, default: null },
    version: { type: Number, default: null },
    name: { type: String, required: true },
    dbSource: { type: String, required: true },
    group: { type: String, required: true },
    jasparCollection: { type: String, default: null },
    taxGroup: { type: String, default: null },
    tfClass: { type: String, default: null },
    family: { type: String, default: null },
    species: [
      {
        taxId: Number,
        name: String,
      },
    ],
    pfm: {
      A: [Number],
      C: [Number],
      G: [Number],
      T: [Number],
    },
    uniprotIds: [String],
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

MotifSchema.index({ databaseRef: 1, group: 1 });
MotifSchema.index({ name: "text" });

export const Motif =
  mongoose.models.Motif || mongoose.model<IMotif>("Motif", MotifSchema);
