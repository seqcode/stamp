import type { JasparMatrix } from "@/types";

const JASPAR_API_BASE = "https://jaspar.elixir.no/api/v1";

interface JasparListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: JasparApiMatrix[];
}

interface JasparApiMatrix {
  matrix_id: string;
  name: string;
  collection: string;
  base_id: string;
  version: number;
  url: string;
}

interface JasparApiMatrixDetail {
  matrix_id: string;
  base_id: string;
  version: number;
  name: string;
  collection: string;
  tax_group: string;
  class: string[];
  family: string[];
  species: { tax_id: number; name: string }[];
  pfm: { A: number[]; C: number[]; G: number[]; T: number[] };
  uniprot_ids: string[];
}

/**
 * Fetch all matrix IDs from JASPAR, optionally filtered by collection and taxon.
 */
export async function fetchMatrixList(options?: {
  collection?: string;
  taxGroup?: string;
  pageSize?: number;
}): Promise<JasparApiMatrix[]> {
  const { collection = "CORE", pageSize = 100 } = options || {};
  const allResults: JasparApiMatrix[] = [];

  let url = `${JASPAR_API_BASE}/matrix/?format=json&page_size=${pageSize}&collection=${collection}`;
  if (options?.taxGroup) {
    url += `&tax_group=${options.taxGroup}`;
  }

  while (url) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`JASPAR API error: ${res.status} ${res.statusText}`);
    }

    const data: JasparListResponse = await res.json();
    allResults.push(...data.results);

    url = data.next || "";

    // Be polite to the API
    if (url) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return allResults;
}

/**
 * Fetch detailed information for a single matrix.
 */
export async function fetchMatrixDetail(
  matrixId: string
): Promise<JasparMatrix> {
  const res = await fetch(
    `${JASPAR_API_BASE}/matrix/${matrixId}/?format=json`
  );

  if (!res.ok) {
    throw new Error(`JASPAR API error for ${matrixId}: ${res.status}`);
  }

  const data: JasparApiMatrixDetail = await res.json();

  return {
    matrix_id: data.matrix_id,
    base_id: data.base_id,
    version: data.version,
    name: data.name,
    collection: data.collection,
    tax_group: data.tax_group,
    class: data.class?.[0] || null,
    family: data.family?.[0] || null,
    species: data.species || [],
    pfm: data.pfm,
    uniprot_ids: data.uniprot_ids || [],
  };
}

/**
 * Fetch all available taxon groups from JASPAR.
 */
export async function fetchTaxonGroups(): Promise<string[]> {
  const res = await fetch(`${JASPAR_API_BASE}/taxon/?format=json`);
  if (!res.ok) {
    throw new Error(`JASPAR API error: ${res.status}`);
  }
  const data = await res.json();
  return data.results?.map((t: { tax_group: string }) => t.tax_group) || [];
}
