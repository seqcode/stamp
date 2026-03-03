import { nanoid } from "nanoid";

export function generateJobId(): string {
  return nanoid(21);
}
