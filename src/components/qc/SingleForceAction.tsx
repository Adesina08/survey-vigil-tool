import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import type { MapSubmission, QCStatus } from "@/types/submission";

const STORAGE_KEY = "qcStatuses";

type StoredStatus = {
  status: QCStatus;
  officer: string;
  comment: string;
  timestamp: string;
};

type ForceActionState = {
  submission: MapSubmission;
  nextStatus: QCStatus;
};

type PersistedMap = Record<string, StoredStatus>;

const readPersisted = (): PersistedMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Failed to parse QC overrides", error);
    return {};
  }
};

const writePersisted = (payload: PersistedMap) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

interface SingleForceActionModalProps {
  state: ForceActionState | null;
  onClose: () => void;
  onPersist: (submissionId: string, record: StoredStatus) => void;
}

const SingleForceActionModal = ({ state, onClose, onPersist }: SingleForceActionModalProps) => {
  const [officer, setOfficer] = useState("");
  const [comment, setComment] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (state) {
      setOfficer("");
      setComment("");
    }
  }, [state]);

  const title = state?.nextStatus === "approved" ? "Force Approve" : "Force Cancel";
  const description = state?.submission
    ? `Update submission ${state.submission.id} (${state.submission.interviewerName})`
    : "";

  const handleSubmit = useCallback(() => {
    if (!state) return;
    if (!officer.trim() || !comment.trim()) {
      toast({
        title: "Missing details",
        description: "Please provide both QC officer name and comment.",
        variant: "destructive",
      });
      return;
    }

    const record: StoredStatus = {
      status: state.nextStatus,
      officer: officer.trim(),
      comment: comment.trim(),
      timestamp: new Date().toISOString(),
    };

    const current = readPersisted();
    current[state.submission.id] = record;
    writePersisted(current);
    onPersist(state.submission.id, record);
    toast({
      title: "Status updated",
      description: `Submission ${state.submission.id} marked as ${state.nextStatus.replace("_", " ")}.`,
    });
    onClose();
  }, [comment, officer, onClose, onPersist, state, toast]);

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="qc-officer">QC Officer Name</Label>
            <Input
              id="qc-officer"
              value={officer}
              onChange={(event) => setOfficer(event.target.value)}
              placeholder="Enter officer name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qc-comment">Comment</Label>
            <Textarea
              id="qc-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Provide context for the override"
              rows={4}
            />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export interface SingleForceActionHookResult {
  openForceAction: (submission: MapSubmission, status: QCStatus) => void;
  modal: JSX.Element;
  overrides: PersistedMap;
}

export const useSingleForceAction = (
  onPersist?: (submissionId: string, record: StoredStatus) => void,
): SingleForceActionHookResult => {
  const [state, setState] = useState<ForceActionState | null>(null);
  const [overrides, setOverrides] = useState<PersistedMap>(() => readPersisted());

  const handlePersist = useCallback(
    (submissionId: string, record: StoredStatus) => {
      setOverrides((prev) => {
        const next = { ...prev, [submissionId]: record };
        onPersist?.(submissionId, record);
        return next;
      });
    },
    [onPersist],
  );

  const modal = useMemo(
    () => (
      <SingleForceActionModal
        state={state}
        onClose={() => setState(null)}
        onPersist={(submissionId, record) => {
          handlePersist(submissionId, record);
        }}
      />
    ),
    [handlePersist, state],
  );

  const openForceAction = useCallback((submission: MapSubmission, status: QCStatus) => {
    setState({ submission, nextStatus: status });
  }, []);

  return { openForceAction, modal, overrides };
};

export type { StoredStatus };
