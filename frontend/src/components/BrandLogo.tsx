interface BrandLogoProps {
  size?: number;
  showName?: boolean;
  className?: string;
}

export const BRAND_NAME = "CoRide";

export function BrandLogo({ size = 36, showName = true, className = "" }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img src="/coride-logo.svg" alt={showName ? "" : BRAND_NAME} width={size} height={size} className="shrink-0" />
      {showName && (
        <span className="text-xl font-semibold tracking-tight text-foreground">
          Co<span className="text-primary">Ride</span>
        </span>
      )}
    </span>
  );
}
