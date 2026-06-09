import { useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  tribooLogoCdnSrc,
  tribooLogoLocalSrc,
  tribooLogoVariantsForSurface,
  type TribooLogoMark,
  type TribooLogoSurface,
  type TribooLogoVariant,
} from "@/constants/tribooBrand";

interface TribooLogoProps {
  /** Explicit asset; ignored when `surface` is set */
  variant?: TribooLogoVariant;
  /** Pick brand-correct asset for light vs dark backgrounds */
  surface?: TribooLogoSurface;
  mark?: TribooLogoMark;
  className?: string;
  imgClassName?: string;
  href?: string;
  label?: string;
}

function LogoImg({
  variant,
  label,
  imgClassName,
}: {
  variant: TribooLogoVariant;
  label: string;
  imgClassName?: string;
}) {
  const [src, setSrc] = useState(() => tribooLogoLocalSrc(variant));
  const isSymbol = variant.startsWith("symbol");

  return (
    <img
      src={src}
      alt={label}
      className={cn(
        "h-full w-auto max-w-full object-contain object-left",
        imgClassName,
      )}
      width={isSymbol ? 44 : 200}
      height={isSymbol ? 44 : 44}
      decoding="async"
      onError={() => {
        const fallback = tribooLogoCdnSrc(variant);
        if (src !== fallback) setSrc(fallback);
      }}
    />
  );
}

function LogoShell({
  variant,
  visibility,
  mark,
  className,
  imgClassName,
  href,
  label,
}: {
  variant: TribooLogoVariant;
  visibility?: string;
  mark: TribooLogoMark;
  className?: string;
  imgClassName?: string;
  href?: string;
  label: string;
}) {
  const isSymbol = mark === "symbol";
  const shell = cn(
    "inline-flex items-center shrink-0",
    isSymbol ? "h-9 w-9" : "h-9 sm:h-10 min-w-0 max-w-[min(200px,52vw)]",
    visibility,
    className,
  );
  const img = <LogoImg variant={variant} label={label} imgClassName={imgClassName} />;

  if (!href) {
    return <span className={shell}>{img}</span>;
  }

  return (
    <Link
      to={href}
      className={cn(shell, "transition-opacity hover:opacity-90")}
      aria-label={label}
    >
      {img}
    </Link>
  );
}

export default function TribooLogo({
  variant = "horizontal-white",
  surface,
  mark = "horizontal",
  className,
  imgClassName,
  href = "/",
  label = "Triboo Sport",
}: TribooLogoProps) {
  if (surface === "auto") {
    const { light, dark } = tribooLogoVariantsForSurface("auto", mark) as {
      light: TribooLogoVariant;
      dark: TribooLogoVariant;
    };
    return (
      <>
        <LogoShell
          variant={light}
          visibility="dark:hidden"
          mark={mark}
          className={className}
          imgClassName={imgClassName}
          href={href}
          label={label}
        />
        <LogoShell
          variant={dark}
          visibility="hidden dark:inline-flex"
          mark={mark}
          className={className}
          imgClassName={imgClassName}
          href={href}
          label={label}
        />
      </>
    );
  }

  const resolved =
    surface != null
      ? (tribooLogoVariantsForSurface(surface, mark) as TribooLogoVariant)
      : variant;

  return (
    <LogoShell
      variant={resolved}
      mark={mark}
      className={className}
      imgClassName={imgClassName}
      href={href}
      label={label}
    />
  );
}
