import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchAppVersion } from "@/store/slices/appConfigSlice";

interface AppVersionLabelProps {
  className?: string;
}

/** Discreet footer version label — build-time env or API fallback */
export default function AppVersionLabel({ className }: AppVersionLabelProps) {
  const dispatch = useAppDispatch();
  const { version, loadingVersion } = useAppSelector((s) => s.appConfig);

  useEffect(() => {
    if (!import.meta.env.VITE_APP_VERSION) {
      dispatch(fetchAppVersion());
    }
  }, [dispatch]);

  if (!version || loadingVersion) return null;

  return (
    <span
      className={cn(
        "text-[10px] tabular-nums text-muted-foreground/70 select-none",
        className,
      )}
      aria-label={`Application version ${version}`}
    >
      v{version}
    </span>
  );
}
