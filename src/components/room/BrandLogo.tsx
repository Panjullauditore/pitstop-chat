import Image from "next/image";
import {useI18n} from "@/lib/i18n";

interface BrandLogoProps {
  className?: string;
  size?: number;
}

export function BrandLogo({ className = "", size = 32 }: BrandLogoProps) {
  const {t}=useI18n();
  return (
    <Image
      src="/brand/pitlane-symbol.png"
      alt={t("Logo Pitstop — simpul kolaborasi oranye, biru, dan cyan")}
      width={size}
      height={size}
      className={`shrink-0 select-none object-contain ${className}`}
      style={{ width: size, height: size }}
      priority
    />
  );
}
