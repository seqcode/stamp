import mongoose, { Schema, Document, Types } from "mongoose";

export interface IMotif extends Document {
  databaseRef: Types.ObjectId;
  matrixId: string;
  baseId: string;
  version: number;
  name: string;
  jasparCollection: string;
  taxGroup: string;
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
    baseId: { type: String, required: true },
    version: { type: Number, required: true },
    name: { type: String, required: true },
    jasparCollection: { type: String, required: true },
    taxGroup: { type: String, required: true },
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

MotifSchema.index({ databaseRef: 1, taxGroup: 1 });
MotifSchema.index({ name: "text" });

export const Motif =
  mongoose.models.Motif || mongoose.model<IMotif>("Motif", MotifSchema);
