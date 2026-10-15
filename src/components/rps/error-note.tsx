import { errorMessage } from "@/lib/errors";

/**
 * The red alert at the top of a page. Takes a short error CODE (usually
 * from ?error= in the address) and shows its fixed message — never the
 * raw text from the address bar or the database.
 */
export function ErrorNote({ code }: { code: unknown }) {
  const message = errorMessage(code);
  if (!message) return null;
  return (
    <p
      className="mb-4 rounded-xl border-l-4 border-danger bg-danger-soft p-3 text-sm font-semibold text-danger"
      role="alert"
    >
      {message}
    </p>
  );
}
