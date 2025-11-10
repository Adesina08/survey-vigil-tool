import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import type { QCAnnotated } from "@/lib/qc/engine";
import { formatErrorLabel } from "@/lib/utils";
import type { QCStatus } from "@/types/submission";

export type CommitPayload = Record<
  string,
  {
    status: QCStatus;
    officer: string;
    comment: string;
    timestamp: string;
  }
>;

const STORAGE_KEY = "qcStatuses";

type Props = {
  rows: QCAnnotated[];
  onCommit: (payload: CommitPayload) => void;
};

const readStoredStatuses = (): CommitPayload => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return Object.entries(parsed).reduce<CommitPayload>((acc, [key, value]) => {
      if (!value || typeof value !== "object") {
        return acc;
      }
      const candidate = value as Record<string, unknown>;
      const status = candidate.status === "approved" ? "approved" : candidate.status === "not_approved" ? "not_approved" : null;
      if (!status) {
        return acc;
      }
      const officer = typeof candidate.officer === "string" ? candidate.officer : "";
      const comment = typeof candidate.comment === "string" ? candidate.comment : "";
      const timestamp = typeof candidate.timestamp === "string" ? candidate.timestamp : new Date().toISOString();
      acc[key] = { status, officer, comment, timestamp };
      return acc;
    }, {});
  } catch (error) {
    console.warn("Unable to parse stored QC statuses", error);
    return {};
  }
};

const persistStatuses = (payload: CommitPayload) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const existing = readStoredStatuses();
    const merged: CommitPayload = { ...existing, ...payload };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (error) {
    console.warn("Failed to persist QC statuses", error);
  }
};

const buildErrorSet = (row: QCAnnotated) => {
  const combined = new Set<string>();
  row.errorTypes.forEach((item) => combined.add(item));
  row.autoFlags.forEach((item) => combined.add(item));
  return combined;
};

export function BulkActionDrawer({ rows, onCommit }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorFilter, setErrorFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [officer, setOfficer] = useState("");
  const [comment, setComment] = useState("");

  const errorOptions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((row) => {
      buildErrorSet(row).forEach((value) => set.add(value));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesTerm = term ? row.id.toLowerCase().includes(term) : true;
      if (!matchesTerm) return false;
      if (errorFilter === "all") {
        return true;
      }
      const errors = buildErrorSet(row);
      return errors.has(errorFilter);
    });
  }, [rows, searchTerm, errorFilter]);

  const isAllSelected = filteredRows.length > 0 && filteredRows.every((row) => selectedIds.has(row.id));

  const toggleSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredRows.map((row) => row.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const applyBulkChange = (status: QCStatus) => {
    const officerName = officer.trim();
    const commentText = comment.trim();

    if (selectedIds.size === 0) {
      toast({
        title: "No submissions selected",
        description: "Select at least one submission to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!officerName) {
      toast({
        title: "QC officer required",
        description: "Provide the QC officer's name before committing a change.",
        variant: "destructive",
      });
      return;
    }

    if (!commentText) {
      toast({
        title: "Comment required",
        description: "Add a short comment that covers all selected submissions.",
        variant: "destructive",
      });
      return;
    }

    const timestamp = new Date().toISOString();
    const payload: CommitPayload = {};

    selectedIds.forEach((id) => {
      payload[id] = {
        status,
        officer: officerName,
        comment: commentText,
        timestamp,
      };
    });

    persistStatuses(payload);
    onCommit(payload);

    toast({
      title: status === "approved" ? "Bulk approval complete" : "Bulk cancellation complete",
      description: `${selectedIds.size} submission${selectedIds.size === 1 ? "" : "s"} updated by ${officerName}.`,
    });

    setSelectedIds(new Set());
    setOfficer("");
    setComment("");
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" className="w-full md:w-auto">
          Bulk Force Actions
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[90vh] overflow-y-auto">
        <DrawerHeader>
          <DrawerTitle>Bulk force approval or cancellation</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-4 px-6 pb-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-search">Search by Instance ID</Label>
              <Input
                id="bulk-search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Enter instance ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-error-filter">Filter by error type</Label>
              <Select value={errorFilter} onValueChange={setErrorFilter}>
                <SelectTrigger id="bulk-error-filter">
                  <SelectValue placeholder="All errors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All errors</SelectItem>
                  {errorOptions.map((error) => (
                    <SelectItem key={error} value={error}>
                      {formatErrorLabel(error)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      aria-label="Select all submissions"
                      checked={isAllSelected}
                      onCheckedChange={(checked) => handleToggleAll(Boolean(checked))}
                    />
                  </TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Instance ID</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>LGA</TableHead>
                  <TableHead>Errors / Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row, index) => {
                  const combinedErrors = Array.from(buildErrorSet(row));
                  return (
                    <TableRow key={row.id} className={selectedIds.has(row.id) ? "bg-primary/5" : undefined}>
                      <TableCell>
                        <Checkbox
                          aria-label={`Select submission ${row.id}`}
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={() => toggleSelection(row.id)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-medium">{row.id}</TableCell>
                      <TableCell>{row.interviewerName ?? row.interviewerId}</TableCell>
                      <TableCell>{row.state}</TableCell>
                      <TableCell>{row.lga}</TableCell>
                      <TableCell className="max-w-xs whitespace-pre-line text-sm">
                        <div
                          className={`font-semibold ${row.status === "approved" ? "text-success" : "text-destructive"}`}
                        >
                          {row.status === "approved" ? "Approved" : "Not approved"}
                        </div>
                        {combinedErrors.length > 0 ? (
                          <div className="mt-1 text-muted-foreground">
                            {combinedErrors.map((error) => formatErrorLabel(error)).join(", ")}
                          </div>
                        ) : (
                          <div className="mt-1 text-muted-foreground">No errors</div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No submissions match the current filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-officer">QC Officer</Label>
              <Input
                id="bulk-officer"
                value={officer}
                onChange={(event) => setOfficer(event.target.value)}
                placeholder="Officer name"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bulk-comment">Comment (applies to all)</Label>
              <Textarea
                id="bulk-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Add a short justification"
                rows={3}
              />
            </div>
          </div>
        </div>
        <DrawerFooter className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedIds.size} submission{selectedIds.size === 1 ? "" : "s"} selected
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => applyBulkChange("approved")} className="gap-2">
              Confirm Bulk Approval
            </Button>
            <Button variant="destructive" onClick={() => applyBulkChange("not_approved")} className="gap-2">
              Confirm Bulk Cancellation
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
