"use client";

// A form's submit button that shows it is working. While the server is
// saving, it says "Saving…", spins, and can't be tapped again — so on a slow
// connection nobody double-submits or thinks the app froze.

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide-react";
import { Button, type ButtonProps } from "./button";

export function SubmitButton({
  children,
  pendingText = "Saving…",
  disabled,
  ...props
}: ButtonProps & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
