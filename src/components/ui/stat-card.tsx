import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  variant?: "default" | "wellness" | "attention" | "risk";
  description?: string;
  className?: string;
  /**
   * When set the card renders as a react-router Link — clicking it navigates
   * to the detail page for this metric. Adds a focus ring + pointer cursor.
   */
  href?: string;
  /** Escape hatch for non-navigation actions (modals, scroll-to, etc.). */
  onClick?: () => void;
}

const variantStyles = {
  default: "bg-card border-border",
  wellness: "bg-wellness/5 border-wellness/20",
  attention: "bg-attention/5 border-attention/20",
  risk: "bg-risk/5 border-risk/20",
};

const iconStyles = {
  default: "bg-secondary text-secondary-foreground",
  wellness: "bg-wellness/10 text-wellness",
  attention: "bg-attention/10 text-attention",
  risk: "bg-risk/10 text-risk",
};

export function StatCard({
  title,
  value,
  icon: Icon,
  variant = "default",
  description,
  className,
  href,
  onClick,
}: StatCardProps) {
  const interactive = !!href || !!onClick;
  const containerClasses = cn(
    "rounded-xl border p-5 shadow-card transition-all duration-200",
    interactive
      ? "hover:shadow-md hover:-translate-y-0.5 hover:border-primary/40 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      : "hover:shadow-md",
    variantStyles[variant],
    className
  );

  const body = (
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-3xl font-semibold tracking-tight text-foreground">
          {value}
        </p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {Icon && (
        <div
          className={cn(
            "rounded-lg p-2.5",
            iconStyles[variant]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link to={href} className={cn(containerClasses, "block")} aria-label={title}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(containerClasses, "block w-full text-left")}>
        {body}
      </button>
    );
  }
  return <div className={containerClasses}>{body}</div>;
}
