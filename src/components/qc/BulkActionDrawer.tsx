import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
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
import { formatErrorLabel } from "@/lib/utils";
import type { MapSubmission } from "@/types/submission";
import type { QCOverrideRecord } from "@/hooks/useQcOverrides";

interface BulkActionDrawerProps {
  submissions: MapSubmission[];
  errorTypes: string[];
  overrides: Record<string, QCOverrideRecord>;
  onSetOverride: (id: string, record: QCOverrideRecord) => void;
}

export function BulkActionDrawer({ submissions, errorTypes, overrides, onSetOverride }: BulkActionDrawerProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [errorFilter, setErrorFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [officer, setOfficer] = useState("");
  const [comment, setComment] = useState("");

  const availableErrors = useMemo(() => {
    const set = new Set<string>(errorTypes);
    submissions.forEach((submission) => {
      submission.errorTypes.forEach((error) => set.add(error));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [errorTypes, submissions]);

  const filteredSubmissions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return submissions.filter((submission) => {
      const matchesTerm = term ? submission.id.toLowerCase().includes(term) : true;
      const matchesError =
        errorFilter === "all" || submission.errorTypes.includes(errorFilter) || overrides[submission.id]?.status === "not_approved";
      return matchesTerm && matchesError;
    });
  }, [searchTerm, submissions, errorFilter, overrides]);

  const isAllSelected = filteredSubmissions.length > 0 && filteredSubmissions.every((submission) => selectedIds.has(submission.id));

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
      setSelectedIds(new Set(filteredSubmissions.map((submission) => submission.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const applyBulkOverride = (mode: "approve" | "cancel") => {
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
        description: "Provide the QC officer's name for audit purposes.",
        variant: "destructive",
      });
      return;
    }

    if (!commentText) {
      toast({
        title: "Comment required",
        description: "Add a brief comment that applies to all selected submissions.",
        variant: "destructive",
      });
      return;
    }

    const timestamp = new Date().toISOString();

    selectedIds.forEach((id) => {
      const record: QCOverrideRecord = {
        status: mode === "approve" ? "approved" : "not_approved",
        officer: officerName,
        comment: commentText,
        timestamp,
      };
      onSetOverride(id, record);
    });

    toast({
      title: mode === "approve" ? "Bulk approval complete" : "Bulk cancellation complete",
      description: `${selectedIds.size} submission${selectedIds.size === 1 ? "" : "s"} updated by ${officerName}.`,
    });

    setSelectedIds(new Set());
    setOfficer("");
    setComment("");
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
                placeholder="Enter submission ID"
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
                  {availableErrors.map((error) => (
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
                  <TableHead>Instance ID</TableHead>
                  <TableHead>Interviewer</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>LGA</TableHead>
                  <TableHead>Current Status</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission) => {
                  const override = overrides[submission.id];
                  const statusLabel = override?.status ?? submission.status;
                  return (
                    <TableRow key={submission.id} className={selectedIds.has(submission.id) ? "bg-primary/5" : undefined}>
                      <TableCell>
                        <Checkbox
                          aria-label={`Select submission ${submission.id}`}
                          checked={selectedIds.has(submission.id)}
                          onCheckedChange={() => toggleSelection(submission.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{submission.id}</TableCell>
                      <TableCell>{submission.interviewerId}</TableCell>
                      <TableCell>{submission.state}</TableCell>
                      <TableCell>{submission.lga}</TableCell>
                      <TableCell className={statusLabel === "approved" ? "text-success" : "text-destructive"}>
                        {statusLabel === "approved" ? "Approved" : "Not approved"}
                      </TableCell>
                      <TableCell className="max-w-xs whitespace-pre-line text-sm text-muted-foreground">
                        {submission.errorTypes.length > 0
                          ? submission.errorTypes.map((error) => formatErrorLabel(error)).join(", ")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filteredSubmissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      No submissions match the selected filters.
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
                placeholder="Enter QC officer name"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bulk-comment">Comment (applies to all)</Label>
              <Textarea
                id="bulk-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Provide a short justification"
                rows={3}
              />
            </div>
          </div>
        </div>
        <DrawerFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedIds.size} submission{selectedIds.size === 1 ? "" : "s"} selected
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => applyBulkOverride("approve")} className="gap-2">
              Confirm Bulk Approval
            </Button>
            <Button variant="destructive" onClick={() => applyBulkOverride("cancel")} className="gap-2">
              Confirm Bulk Cancellation
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
