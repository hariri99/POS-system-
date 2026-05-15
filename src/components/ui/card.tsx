import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-card rounded-[24px] p-5 backdrop-blur-sm lg:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
