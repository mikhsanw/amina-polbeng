"use client";

import { useMemo, useState } from "react";

function valueAt(row: any, path: string) {
  return path.split(".").reduce((value, key) => value?.[key], row);
}

export function useSortableRows<T>(rows: T[], initialKey = "") {
  const [sort, setSort] = useState({ key: initialKey, direction: "asc" as "asc" | "desc" });
  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((left: any, right: any) => {
      const a = valueAt(left, sort.key);
      const b = valueAt(right, sort.key);
      if (a == null && b == null) return 0;
      if (a == null) return -1 * direction;
      if (b == null) return direction;
      if (typeof a === "number" && typeof b === "number") return (a - b) * direction;
      return String(a).localeCompare(String(b), "id", { numeric: true }) * direction;
    });
  }, [rows, sort]);
  const toggle = (key: string) =>
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  return { sorted, sort, toggle };
}

export function SortableTh({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: string;
  sort: { key: string; direction: "asc" | "desc" };
  onSort: (column: string) => void;
}) {
  const active = sort.key === column;
  return (
    <th>
      <button className="sort-head" type="button" onClick={() => onSort(column)}>
        {label}
        <span aria-hidden="true">{active ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}
