"use client";

import { Info } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "~/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export function InfoHover({
  content,
  label = "Weitere Informationen",
  className,
}: {
  content: ReactNode;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setPinned(false);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-expanded={open}
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:outline-none",
            className,
          )}
          onBlur={() => {
            if (!pinned) setOpen(false);
          }}
          onClick={(event) => {
            event.preventDefault();
            const nextPinned = !pinned;
            setPinned(nextPinned);
            setOpen(nextPinned);
          }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => {
            if (!pinned) setOpen(false);
          }}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="text-sm leading-relaxed text-neutral-800"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => {
          if (!pinned) setOpen(false);
        }}
      >
        <p>{content}</p>
      </PopoverContent>
    </Popover>
  );
}

export function InfoLabel({
  children,
  content,
  className,
}: {
  children: ReactNode;
  content: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span>{children}</span>
      <InfoHover content={content} />
    </span>
  );
}
