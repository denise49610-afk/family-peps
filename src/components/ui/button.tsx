import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-extrabold select-none whitespace-nowrap rounded-2xl transition-[transform,background-color,box-shadow,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none active:not-disabled:scale-[0.97]",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg shadow-card hover:brightness-105",
        accent: "bg-accent text-accent-fg shadow-card hover:brightness-105",
        ink: "bg-ink text-surface shadow-card",
        ghost: "bg-transparent text-ink hover:bg-surface-2",
        outline: "bg-surface text-ink card-shadow hover:card-shadow-hover",
        danger: "bg-danger text-surface",
        soft: "bg-surface-2 text-ink",
      },
      size: {
        sm: "h-10 px-3.5 text-sm",
        md: "h-12 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "size-11 p-0",
        pill: "h-10 px-4 text-sm rounded-full",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}

export { buttonVariants };
