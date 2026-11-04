import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Small inline spinner. Inherits the text color, so it works inside buttons.
export function Spinner({ className, label = "Loading", ...props }) {
  return (
    <Loader2
      role="status"
      aria-label={label}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

// Centered loader for a page or a section while its data loads.
export function PageLoader({ label = "Loading…", className, fullScreen = false }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        fullScreen ? "min-h-[60vh]" : "py-16",
        className
      )}
    >
      <Spinner className="size-8 text-primary" label={label} />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
