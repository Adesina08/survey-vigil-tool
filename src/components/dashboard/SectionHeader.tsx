import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeader({ title, subtitle, className }: SectionHeaderProps) {
  return (
    <div className={cn("space-y-1 border-l-4 border-primary pl-4", className)}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        {title}
      </h2>
      {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
