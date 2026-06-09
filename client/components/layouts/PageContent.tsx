import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

const WIDTH_CLASS = {
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
} as const;

export type PageContentWidth = keyof typeof WIDTH_CLASS;

/** Portal / staff page shell — prevents horizontal bleed on mobile */
export default function PageContent({
  children,
  className,
  width = "6xl",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  width?: PageContentWidth;
  as?: ElementType;
}) {
  return (
    <Tag
      className={cn(
        WIDTH_CLASS[width],
        "mx-auto w-full min-w-0 overflow-x-clip",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
