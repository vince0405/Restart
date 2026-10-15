import { errorMessage, FORM_ERROR_ID } from "@/lib/errors";
import { Notice } from "./notice";

/**
 * The red alert at the top of a page. Takes a short error CODE (usually
 * from ?error= in the address) and shows its fixed message — never the
 * raw text from the address bar or the database.
 */
export function ErrorNote({ code }: { code: unknown }) {
  const message = errorMessage(code);
  if (!message) return null;
  return (
    <Notice tone="error" id={FORM_ERROR_ID}>
      {message}
    </Notice>
  );
}
