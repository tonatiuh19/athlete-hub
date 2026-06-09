import { extractApiErrorMessage } from "@/utils/apiError";

/** Renders API/auth errors as text (never raw objects). */
export default function AuthFormError({ error }: { error: unknown }) {
  const message =
    typeof error === "string"
      ? error.trim()
      : error
        ? extractApiErrorMessage(error)
        : "";
  if (!message) return null;

  return (
    <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 px-4 py-3 rounded-xl">
      {message}
    </div>
  );
}
