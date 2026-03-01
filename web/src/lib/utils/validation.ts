import { z } from "zod";

export const columnMetricSchema = z.enum(["PCC", "ALLR", "ALLR_LL", "CS", "KL", "SSD"]);
export const alignmentMethodSchema = z.enum(["SWU", "SWA", "SW", "NW"]);
export const multipleAlignmentSchema = z.enum(["PPA", "IR", "NONE"]);
export const treeMethodSchema = z.enum(["UPGMA", "NJ"]);

export const stampParamsSchema = z.object({
  columnMetric: columnMetricSchema.default("PCC"),
  alignmentMethod: alignmentMethodSchema.default("SWU"),
  multipleAlignment: multipleAlignmentSchema.default("PPA"),
  treeMethod: treeMethodSchema.default("UPGMA"),
  gapOpen: z.number().min(0).max(1000).default(1.0),
  gapExtend: z.number().min(0).max(1000).default(0.5),
  overlapAlign: z.boolean().default(true),
  forwardOnly: z.boolean().default(false),
});

export const databaseSelectionSchema = z.object({
  slug: z.string(),
  groups: z.array(z.string()).default([]),
});

export const matchingConfigSchema = z.object({
  enabled: z.boolean().default(false),
  databases: z.array(databaseSelectionSchema).default([]),
  topMatches: z.number().int().min(1).max(50).default(5),
  customDbFileKey: z.string().nullable().default(null),
});

export const jobSubmitSchema = z.object({
  motifText: z.string().max(10 * 1024 * 1024).optional(), // 10MB text limit
  params: stampParamsSchema.default({}),
  matching: matchingConfigSchema.default({}),
  email: z.string().email().nullable().optional().default(null),
});

export const adminAuthSchema = z.object({
  password: z.string().min(1),
});
