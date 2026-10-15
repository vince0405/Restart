import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Focus uses the app-wide ring in globals.css. Pressed: a small squeeze.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-[background-color,color,transform,opacity,box-shadow] duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-60 aria-busy:cursor-progress",
  {
    variants: {
      variant: {
        // The one main action on a screen.
        default: "bg-primary text-primary-foreground shadow-logo hover:bg-brand-dark",
        // A second, quieter action.
        secondary: "border border-line bg-secondary text-secondary-foreground hover:border-field",
        outline: "border border-field bg-card text-ink hover:bg-secondary",
        ghost: "text-ink hover:bg-secondary",
        // Deleting, cancelling for good.
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90",
      },
      // Heights: 44px (small), 48px (normal), 52px (big). Never under 44px,
      // so every button is easy to hit with a thumb.
      size: {
        sm: "min-h-11 px-3",
        default: "min-h-12 px-4 py-2",
        lg: "min-h-13 px-5 text-base",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { buttonVariants };
