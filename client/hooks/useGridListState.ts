import { useCallback, useMemo, useState } from "react";
import type { GridListParams } from "@/store/slices/staffPortalSlice";

export function useGridListState(defaultSortBy = "created_at", defaultLimit = 20) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState(defaultSortBy);
  const [sortDir, setSortDir] = useState<"ASC" | "DESC">("DESC");

  const onSort = useCallback(
    (key: string) => {
      if (sortBy === key) {
        setSortDir((d) => (d === "ASC" ? "DESC" : "ASC"));
      } else {
        setSortBy(key);
        setSortDir("DESC");
      }
      setPage(1);
    },
    [sortBy],
  );

  const gridParams: GridListParams = useMemo(
    () => ({
      page,
      limit: defaultLimit,
      sortBy,
      sortDir,
    }),
    [page, defaultLimit, sortBy, sortDir],
  );

  return { page, setPage, sortBy, sortDir, onSort, gridParams };
}
