import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title?: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeader({ title, subtitle, className }: SectionHeaderProps) {
  const trimmedTitle = typeof title === "string" ? title.trim() : "";
  const trimmedSubtitle = typeof subtitle === "string" ? subtitle.trim() : "";
  const hasTitle = trimmedTitle.length > 0;
  const hasSubtitle = trimmedSubtitle.length > 0;

  if (!hasTitle && !hasSubtitle) {
    return null;
  }

  return (
    <div className={cn("space-y-1 border-l-4 border-primary pl-4", className)}>
      {hasTitle ? (
        <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          {trimmedTitle}
        </h2>
      ) : null}
      {hasSubtitle ? <p className="text-sm text-muted-foreground">{trimmedSubtitle}</p> : null}
    </div>
  );
}
