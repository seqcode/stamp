import mongoose, { Schema, Document } from "mongoose";
import type {
  JobStatus,
  StampParams,
  MatchingConfig,
  JobInput,
  JobResults,
} from "@/types";

export interface IJob extends Document {
  jobId: string;
  status: JobStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  input: JobInput;
  params: StampParams;
  matching: MatchingConfig;
  email: string | null;
  results: JobResults | null;
  files: {
    inputTransfac: string;
    scoreDistFile: string;
    matchDbFile: string | null;
    outputPrefix: string;
    resultsDir: string;
  } | null;
  error: string | null;
}

const JobSchema = new Schema<IJob>(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ["queued", "running", "processing_results", "complete", "failed"],
      default: "queued",
    },
    completedAt: { type: Date, default: null },

    input: {
      motifs: [
        {
          name: String,
          matrix: [[Number]],
          format: { type: String, enum: ["transfac", "meme", "jaspar", "modisco"] },
        },
      ],
      rawText: { type: String, default: null },
      fileName: { type: String, default: null },
    },

    params: {
      columnMetric: { type: String, default: "PCC" },
      alignmentMethod: { type: String, default: "SWU" },
      multipleAlignment: { type: String, default: "PPA" },
      treeMethod: { type: String, default: "UPGMA" },
      gapOpen: { type: Number, default: 1.0 },
      gapExtend: { type: Number, default: 0.5 },
      overlapAlign: { type: Boolean, default: true },
      forwardOnly: { type: Boolean, default: false },
    },

    matching: {
      enabled: { type: Boolean, default: false },
      taxonGroups: [String],
      topMatches: { type: Number, default: 5 },
      customDbFileKey: { type: String, default: null },
    },

    email: { type: String, default: null },

    results: {
      type: Schema.Types.Mixed,
      default: null,
    },

    files: {
      type: Schema.Types.Mixed,
      default: null,
    },

    error: { type: String, default: null },
  },
  {
    timestamps: true,
  }
);

// TTL index for automatic cleanup after 7 days
JobSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7 * 24 * 60 * 60 }
);

export const Job =
  mongoose.models.Job || mongoose.model<IJob>("Job", JobSchema);
