import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RankingEntry } from "@/utils/qcMetrics";

interface RankingTableProps {
  data: RankingEntry[];
  totals: {
    total: number;
    approved: number;
    flagged: number;
  };
}

type SortKey = "ranking" | "interviewerId" | "total" | "approved" | "flagged";

const defaultSortDirection: Record<SortKey, "asc" | "desc"> = {
  ranking: "asc",
  interviewerId: "asc",
  total: "desc",
  approved: "desc",
  flagged: "asc",
};

const comparatorForKey = (key: SortKey, direction: "asc" | "desc") => {
  const multiplier = direction === "asc" ? 1 : -1;
  return (a: RankingEntry, b: RankingEntry) => {
    if (key === "interviewerId") {
      return multiplier * a.interviewerId.localeCompare(b.interviewerId);
    }

    const fieldA = a[key] ?? 0;
    const fieldB = b[key] ?? 0;
    if (fieldA === fieldB) {
      return multiplier * a.interviewerId.localeCompare(b.interviewerId);
    }
    return multiplier * (fieldA - fieldB);
  };
};

export const RankingTable = ({ data, totals }: RankingTableProps) => {
  const ranked = useMemo(() => data.slice(0).sort((a, b) => {
    if (b.approved !== a.approved) return b.approved - a.approved;
    if (a.flagged !== b.flagged) return a.flagged - b.flagged;
    if (b.total !== a.total) return b.total - a.total;
    return a.interviewerId.localeCompare(b.interviewerId);
  }), [data]);

  const rankMap = useMemo(() => {
    const map = new Map<string, number>();
    ranked.forEach((entry, index) => {
      map.set(entry.interviewerId, index + 1);
    });
    return map;
  }, [ranked]);

  const [sortKey, setSortKey] = useState<SortKey>("ranking");
  const [direction, setDirection] = useState<"asc" | "desc">(defaultSortDirection.ranking);

  const sorted = useMemo(() => {
    if (sortKey === "ranking") {
      return ranked;
    }

    const items = ranked.slice(0);
    items.sort(comparatorForKey(sortKey, direction));
    return items;
  }, [ranked, sortKey, direction]);

  const topTen = sorted.slice(0, 10);

  const handleSort = (key: SortKey) => {
    if (key === "ranking") {
      setSortKey("ranking");
      setDirection(defaultSortDirection.ranking);
      return;
    }

    if (sortKey === key) {
      setDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setDirection(defaultSortDirection[key]);
  };

  const SortButton = ({ column }: { column: SortKey }) => (
    <button
      type="button"
      onClick={() => handleSort(column)}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      Sort
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <Card className="border-none shadow-lg shadow-primary/10">
      <CardHeader>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Top Enumerator Performance</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Ranked by highest approvals, lowest flags, and overall workload. Showing top 10 enumerators.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="border-muted text-muted-foreground">
              Total {totals.total.toLocaleString()}
            </Badge>
            <Badge variant="outline" className="border-success/40 text-success">
              Approved {totals.approved.toLocaleString()}
            </Badge>
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              Flagged {totals.flagged.toLocaleString()}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {topTen.length === 0 ? (
          <p className="text-sm text-muted-foreground">No interview submissions found.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-muted-foreground">Rank</TableHead>
                  <TableHead className="min-w-[160px] text-foreground">
                    Interviewer
                    <SortButton column="interviewerId" />
                  </TableHead>
                  <TableHead className="text-right text-foreground">
                    Approved
                    <SortButton column="approved" />
                  </TableHead>
                  <TableHead className="text-right text-foreground">
                    Flagged
                    <SortButton column="flagged" />
                  </TableHead>
                  <TableHead className="text-right text-foreground">
                    Total Interviews
                    <SortButton column="total" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topTen.map((entry) => (
                  <TableRow key={entry.interviewerId}>
                    <TableCell className="font-medium text-muted-foreground">
                      {rankMap.get(entry.interviewerId)}
                    </TableCell>
                    <TableCell className="font-medium">{entry.interviewerId}</TableCell>
                    <TableCell className="text-right font-semibold text-success">
                      {entry.approved.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-destructive">
                      {entry.flagged.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {entry.total.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

