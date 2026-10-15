"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the phone's or computer's print dialog (also "Save as PDF"). */
export function PrintButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" aria-hidden />
      Print or save
    </Button>
  );
}
