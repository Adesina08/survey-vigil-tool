import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOMServer from "react-dom/server";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import { Download, MapPin, ListFilter } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatErrorLabel } from "@/lib/utils";
import { loadLgaBoundaries, type LgaBoundaryFeature } from "@/lib/geo/lgaBoundaries";
import type { QCOverrideRecord } from "@/hooks/useQcOverrides";
import type { MapSubmission, QCStatus } from "@/types/submission";

const APPROVED_COLOR = "#16a34a";
const NOT_APPROVED_COLOR = "#dc2626";

const APPROVED_LABEL = "APPROVED";
const NOT_APPROVED_LABEL = "NOT APPROVED";

const STATUS_COLORS: Record<QCStatus, string> = {
  approved: APPROVED_COLOR,
  not_approved: NOT_APPROVED_COLOR,
};

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

type DecoratedSubmission = MapSubmission & {
  override?: QCOverrideRecord;
  derivedErrors: string[];
};

interface InteractiveMapProps {
  submissions: MapSubmission[];
  interviewers: string[];
  errorTypes: string[];
  showLabels?: boolean;
  overrides: Record<string, QCOverrideRecord>;
  onSetOverride: (id: string, record: QCOverrideRecord) => void;
}

type LeafletImageFn = (
  map: L.Map,
  callback: (error: unknown, canvas: HTMLCanvasElement) => void,
) => void;

const loadLeafletImage = async (): Promise<LeafletImageFn> => {
  if (typeof window === "undefined") {
    throw new Error("leaflet-image can only be used in the browser");
  }

  const globalObject = window as unknown as { leafletImage?: LeafletImageFn };

  if (typeof globalObject.leafletImage === "function") {
    return globalObject.leafletImage;
  }

  const existingScript = document.querySelector<HTMLScriptElement>("script[data-leaflet-image]");
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener(
        "load",
        () => {
          if (typeof globalObject.leafletImage === "function") {
            resolve(globalObject.leafletImage);
          } else {
            reject(new Error("leaflet-image failed to initialize"));
          }
        },
        { once: true },
      );
      existingScript.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet-image/leaflet-image.js";
    script.async = true;
    script.dataset.leafletImage = "true";
    script.onload = () => {
      if (typeof globalObject.leafletImage === "function") {
        resolve(globalObject.leafletImage);
      } else {
        reject(new Error("leaflet-image failed to initialize"));
      }
    };
    script.onerror = (event) => reject(event);
    document.body.appendChild(script);
  });
};

const createMarkerIcon = (status: QCStatus) =>
  L.divIcon({
    className: "qc-marker",
    html: `<div style="background:${STATUS_COLORS[status]};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(15,23,42,0.35);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const formatPopup = (submission: DecoratedSubmission) => {
  const statusColor = STATUS_COLORS[submission.status];
  const statusLabel = submission.status === "approved" ? APPROVED_LABEL : NOT_APPROVED_LABEL;
  const errors = submission.derivedErrors.length
    ? submission.derivedErrors.map((error) => formatErrorLabel(error)).join(", ")
    : "None";

  const actionButtons = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
      <button type="button" data-action="approve" data-instance="${submission.id}" style="flex:1;min-width:120px;padding:8px 12px;border-radius:6px;border:1px solid #16a34a;background:#16a34a;color:white;font-weight:600;cursor:pointer;">Force Approve</button>
      <button type="button" data-action="cancel" data-instance="${submission.id}" style="flex:1;min-width:120px;padding:8px 12px;border-radius:6px;border:1px solid #dc2626;background:white;color:#dc2626;font-weight:600;cursor:pointer;">Force Cancel</button>
    </div>
  `;

  const overrideDetails = submission.override
    ? `<div style="margin-top:8px;padding:8px;border-radius:6px;background:rgba(37,99,235,0.08);font-size:12px;line-height:1.4;">
        <div><strong>QC Officer:</strong> ${submission.override.officer}</div>
        <div><strong>Comment:</strong> ${submission.override.comment}</div>
        <div><strong>Override:</strong> ${new Date(submission.override.timestamp).toLocaleString()}</div>
      </div>`
    : "";

  return ReactDOMServer.renderToString(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        minWidth: "240px",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div style={{ fontWeight: 700, color: "#1d4ed8", fontSize: "15px" }}>Submission #{submission.id}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px" }}>
        <div>
          <strong>Interviewer ID:</strong> {submission.interviewerId}
        </div>
        {submission.interviewerName && submission.interviewerName.trim() &&
        submission.interviewerName.trim() !== submission.interviewerId ? (
          <div>
            <strong>Interviewer:</strong> {submission.interviewerName}
          </div>
        ) : null}
        <div>
          <strong>LGA:</strong> {submission.lga}
        </div>
        <div>
          <strong>Status:</strong> <span style={{ color: statusColor, fontWeight: 700 }}>{statusLabel}</span>
        </div>
        <div>
          <strong>Errors:</strong> {errors}
        </div>
        <div style={{ fontSize: "12px", color: "#64748b" }}>{submission.timestamp}</div>
      </div>
      <div dangerouslySetInnerHTML={{ __html: actionButtons }} />
      <div dangerouslySetInnerHTML={{ __html: overrideDetails }} />
    </div>,
  );
};

const fitToContent = (map: L.Map, boundaries: L.Layer | null, points: DecoratedSubmission[]) => {
  const bounds = L.latLngBounds([]);

  if (boundaries) {
    try {
      const boundaryBounds = (boundaries as L.GeoJSON).getBounds?.();
      if (boundaryBounds?.isValid()) {
        bounds.extend(boundaryBounds);
      }
    } catch (error) {
      console.warn("Unable to extend map bounds from boundaries", error);
    }
  }

  points.forEach((submission) => {
    if (typeof submission.lat === "number" && typeof submission.lng === "number") {
      bounds.extend([submission.lat, submission.lng]);
    }
  });

  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [48, 48] });
  }
};

export function InteractiveMap({
  submissions,
  interviewers,
  errorTypes,
  showLabels = true,
  overrides,
  onSetOverride,
}: InteractiveMapProps) {
  const { toast } = useToast();

  const [selectedError, setSelectedError] = useState<string>("all");
  const [selectedInterviewer, setSelectedInterviewer] = useState<string>("all");
  const [labelsEnabled, setLabelsEnabled] = useState<boolean>(showLabels);
  const [modalState, setModalState] = useState<{
    submission: DecoratedSubmission;
    mode: "approve" | "cancel";
  } | null>(null);
  const [officer, setOfficer] = useState("");
  const [comment, setComment] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const labelLayerRef = useRef<L.LayerGroup | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const markersByIdRef = useRef<Map<string, L.Marker>>(new Map());
  const [boundaries, setBoundaries] = useState<LgaBoundaryFeature[]>([]);

  useEffect(() => {
    setLabelsEnabled(showLabels);
  }, [showLabels]);

  const submissionsWithOverrides = useMemo<DecoratedSubmission[]>(() => {
    return submissions.map((submission) => {
      const override = overrides[submission.id];
      const nextStatus = override?.status ?? submission.status;
      const derivedErrors = new Set(submission.errorTypes);

      if (override?.status === "not_approved") {
        derivedErrors.add("Force Cancelled");
      } else if (derivedErrors.has("Force Cancelled")) {
        derivedErrors.delete("Force Cancelled");
      }

      return {
        ...submission,
        status: nextStatus,
        override,
        derivedErrors: Array.from(derivedErrors),
      };
    });
  }, [overrides, submissions]);

  const availableErrorTypes = useMemo(() => {
    const combined = new Set<string>([...errorTypes]);
    submissionsWithOverrides.forEach((submission) => {
      submission.derivedErrors.forEach((error) => combined.add(error));
    });
    return Array.from(combined).sort((a, b) => a.localeCompare(b));
  }, [errorTypes, submissionsWithOverrides]);

  const interviewerDirectory = useMemo(() => {
    const map = new Map<string, string>();
    submissionsWithOverrides.forEach((submission) => {
      const existing = map.get(submission.interviewerId);
      const candidate = submission.interviewerName?.trim() ?? "";
      if (!existing) {
        map.set(submission.interviewerId, candidate);
      } else if (!existing.trim() && candidate) {
        map.set(submission.interviewerId, candidate);
      }
    });
    return map;
  }, [submissionsWithOverrides]);

  const interviewerOptions = useMemo(() => {
    const ids = interviewers.length > 0 ? interviewers : Array.from(interviewerDirectory.keys());
    const unique = Array.from(new Set(ids));
    return unique
      .map((id) => ({ id, label: interviewerDirectory.get(id) || id }))
      .map(({ id, label }) => ({
        id,
        label: label && label.trim() && label !== id ? `${id} · ${label}` : id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [interviewers, interviewerDirectory]);

  const filteredSubmissions = useMemo(() => {
    return submissionsWithOverrides.filter((submission) => {
      const matchesError =
        selectedError === "all" || submission.derivedErrors.includes(selectedError);
      const matchesInterviewer =
        selectedInterviewer === "all" || submission.interviewerId === selectedInterviewer;
      return matchesError && matchesInterviewer;
    });
  }, [selectedError, selectedInterviewer, submissionsWithOverrides]);

  const handleExportMap = useCallback(async () => {
    if (!mapRef.current) return;
    try {
      const leafletImage = await loadLeafletImage();
      leafletImage(mapRef.current, (error, canvas) => {
        if (error || !canvas) {
          console.error("Failed to export map", error);
          toast({
            title: "Export failed",
            description: "Unable to export the current map view. Please try again.",
            variant: "destructive",
          });
          return;
        }

        const link = document.createElement("a");
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        link.href = canvas.toDataURL("image/png");
        link.download = `stream-qc-map-${timestamp}.png`;
        link.click();
      });
    } catch (error) {
      console.error("Failed to export map", error);
      toast({
        title: "Export failed",
        description: "Unable to export the current map view. Please try again.",
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (mapRef.current || !mapContainerRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      center: [7.15, 3.35],
      zoom: 8,
      scrollWheelZoom: true,
      preferCanvas: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(mapRef.current);

    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 200);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      clusterRef.current?.remove();
      clusterRef.current = null;
      labelLayerRef.current?.remove();
      labelLayerRef.current = null;
      boundaryLayerRef.current?.remove();
      boundaryLayerRef.current = null;
      markersByIdRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    let cancelled = false;

    loadLgaBoundaries().then((features) => {
      if (cancelled) return;
      setBoundaries(features);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    boundaryLayerRef.current?.remove();

    if (boundaries.length === 0) {
      boundaryLayerRef.current = null;
      return;
    }

    const geoJsonLayer = L.geoJSON(boundaries.map((entry) => entry.feature), {
      style: () => ({
        color: "#1d4ed8",
        weight: 1.2,
        fillOpacity: 0,
      }),
    });

    geoJsonLayer.addTo(mapRef.current);
    boundaryLayerRef.current = geoJsonLayer;
  }, [boundaries]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!clusterRef.current) {
      clusterRef.current = L.markerClusterGroup({
        chunkedLoading: true,
        disableClusteringAtZoom: 14,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
      }).addTo(mapRef.current);
    }

    const cluster = clusterRef.current;
    cluster.clearLayers();
    markersByIdRef.current.clear();

    const createMarker = (submission: DecoratedSubmission) => {
      if (typeof submission.lat !== "number" || typeof submission.lng !== "number") {
        return null;
      }

      const marker = L.marker([submission.lat, submission.lng], {
        icon: createMarkerIcon(submission.status),
        title: `Submission ${submission.id}`,
      });

      marker.bindPopup(formatPopup(submission), { maxWidth: 320 });

      const listeners: Array<{ element: Element; handler: (event: Event) => void }> = [];

      const teardown = () => {
        listeners.forEach(({ element, handler }) => {
          element.removeEventListener("click", handler);
        });
        listeners.length = 0;
      };

      marker.on("popupopen", () => {
        teardown();
        const popupElement = marker.getPopup()?.getElement();
        if (!popupElement) return;
        ("approve cancel".split(" ") as Array<"approve" | "cancel">).forEach((action) => {
          const button = popupElement.querySelector<HTMLButtonElement>(
            `[data-action="${action}"][data-instance="${submission.id}"]`,
          );
          if (!button) return;
          const handler = (event: Event) => {
            event.preventDefault();
            setFormError(null);
            setOfficer(submission.override?.officer ?? "");
            setComment(submission.override?.comment ?? "");
            setModalState({ submission, mode: action });
          };
          button.addEventListener("click", handler);
          listeners.push({ element: button, handler });
        });
      });

      marker.on("popupclose", () => {
        teardown();
      });

      markersByIdRef.current.set(submission.id, marker);
      return marker;
    };

    const markers = filteredSubmissions
      .map((submission) => createMarker(submission))
      .filter((marker): marker is L.Marker => Boolean(marker));

    cluster.addLayers(markers);
  }, [filteredSubmissions]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!labelLayerRef.current) {
      labelLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const layer = labelLayerRef.current;
    layer.clearLayers();

    if (!labelsEnabled) {
      layer.remove();
      return;
    }

    if (!mapRef.current.hasLayer(layer)) {
      layer.addTo(mapRef.current);
    }

    if (boundaries.length > 0) {
      boundaries.forEach((entry) => {
        const marker = L.marker([entry.centroid[0], entry.centroid[1]], {
          interactive: false,
          opacity: 0,
        });
        marker.bindTooltip(entry.name, {
          permanent: true,
          direction: "center",
          className: "qc-map-label",
          opacity: 0.96,
        });
        marker.addTo(layer);
      });
      return;
    }

    const lgaAggregates = new Map<
      string,
      { lat: number; lng: number; count: number; name: string }
    >();

    filteredSubmissions.forEach((submission) => {
      if (typeof submission.lat !== "number" || typeof submission.lng !== "number") return;
      const key = submission.lga;
      const aggregate = lgaAggregates.get(key) ?? {
        lat: 0,
        lng: 0,
        count: 0,
        name: submission.lga,
      };
      aggregate.lat += submission.lat;
      aggregate.lng += submission.lng;
      aggregate.count += 1;
      lgaAggregates.set(key, aggregate);
    });

    lgaAggregates.forEach((aggregate) => {
      if (aggregate.count === 0) return;
      const marker = L.marker([aggregate.lat / aggregate.count, aggregate.lng / aggregate.count], {
        interactive: false,
        opacity: 0,
      });
      marker.bindTooltip(aggregate.name, {
        permanent: true,
        direction: "center",
        className: "qc-map-label",
        opacity: 0.96,
      });
      marker.addTo(layer);
    });
  }, [labelsEnabled, boundaries, filteredSubmissions]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    fitToContent(map, boundaryLayerRef.current, filteredSubmissions);
  }, [filteredSubmissions, boundaries]);

  useEffect(() => {
    if (!mapRef.current) return;
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 200);
  }, [filteredSubmissions.length]);

  const handleOverride = useCallback(
    (submission: DecoratedSubmission, mode: "approve" | "cancel", officerName: string, note: string) => {
      const record: QCOverrideRecord = {
        status: mode === "approve" ? "approved" : "not_approved",
        officer: officerName.trim(),
        comment: note.trim(),
        timestamp: new Date().toISOString(),
      };
      onSetOverride(submission.id, record);
      toast({
        title: mode === "approve" ? "Submission approved" : "Submission cancelled",
        description: `Instance ${submission.id} updated by ${record.officer}.`,
      });
      setModalState(null);
    },
    [setOverride, toast],
  );

  const confirmOverride = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modalState) return;

    const officerName = officer.trim();
    const note = comment.trim();

    if (!officerName) {
      setFormError("Please provide the QC officer's name.");
      return;
    }

    if (!note) {
      setFormError("Please provide a short comment to justify the override.");
      return;
    }

    handleOverride(modalState.submission, modalState.mode, officerName, note);
  };

  return (
    <Card className="fade-in">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <CardTitle className="text-left">QC Map</CardTitle>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedError} onValueChange={setSelectedError}>
            <SelectTrigger className="min-w-[180px]">
              <SelectValue placeholder="All Error Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Error Types</SelectItem>
              {availableErrorTypes.map((error) => (
                <SelectItem key={error} value={error}>
                  {formatErrorLabel(error)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedInterviewer} onValueChange={setSelectedInterviewer}>
            <SelectTrigger className="min-w-[200px]">
              <SelectValue placeholder="All Interviewers" />
            </SelectTrigger>
            <SelectContent className="z-[2000]">
              <SelectItem value="all">All Interviewers</SelectItem>
              {interviewerOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <Switch id="toggle-labels" checked={labelsEnabled} onCheckedChange={setLabelsEnabled} />
            <Label htmlFor="toggle-labels" className="cursor-pointer select-none">
              Show LGA labels
            </Label>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-[500px] w-full overflow-hidden rounded-lg border">
          <div ref={mapContainerRef} className="h-full w-full" />
          <div className="pointer-events-none absolute inset-0" />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ListFilter className="hidden h-4 w-4 text-muted-foreground sm:block" />
            Showing {filteredSubmissions.length.toLocaleString()} submissions
          </div>
          <Button variant="outline" size="sm" onClick={handleExportMap} className="gap-2">
            <Download className="h-4 w-4" />
            Export Map PNG
          </Button>
        </div>
      </CardContent>

      <Dialog open={Boolean(modalState)} onOpenChange={(open) => !open && setModalState(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={confirmOverride} className="space-y-4">
            <DialogHeader>
              <DialogTitle>
                {modalState?.mode === "approve" ? "Force approve submission" : "Force cancel submission"}
              </DialogTitle>
              <DialogDescription>
                Provide your details and a short comment. The action will be stored locally on this device and
                reflected on the map immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="qc-officer">QC Officer</Label>
              <Input
                id="qc-officer"
                value={officer}
                onChange={(event) => setOfficer(event.target.value)}
                placeholder="Enter officer name"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qc-comment">Comment</Label>
              <Textarea
                id="qc-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Why is this submission being updated?"
                rows={4}
              />
            </div>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalState(null)}
              >
                Cancel
              </Button>
              <Button type="submit" className="gap-2">
                {modalState?.mode === "approve" ? "Confirm Approval" : "Confirm Cancellation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
