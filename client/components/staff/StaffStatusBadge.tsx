import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<string, string> = {
  published: "bg-cyan/15 text-cyan border-cyan/30",
  confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  draft: "bg-muted text-muted-foreground border-border",
  archived: "bg-muted/80 text-muted-foreground border-border",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
  completed: "bg-blue-electric/15 text-blue-electric border-blue-electric/30",
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  suspended: "bg-destructive/15 text-destructive border-destructive/30",
};

interface StaffStatusBadgeProps {
  status: string;
  className?: string;
}

export default function StaffStatusBadge({ status, className }: StaffStatusBadgeProps) {
  const key = status.toLowerCase();
  return (
    <Badge
      variant="outline"
      className={cn(
        "capitalize font-medium",
        STATUS_STYLES[key] ?? "bg-muted/50 text-muted-foreground",
        className,
      )}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
