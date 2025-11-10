import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

import type { FeatureCollection, Geometry, MultiPolygon, Polygon } from "geojson";

import { Button } from "@/components/ui/button";
import type { StoredStatus } from "@/components/qc/SingleForceAction";
import { useSingleForceAction } from "@/components/qc/SingleForceAction";
import { featureCentroid } from "@/lib/geo/pip";
import type { ErrorType, MapSubmission, QCStatus } from "@/types/submission";

const STATUS_COLORS: Record<QCStatus, string> = {
  approved: "#16a34a",
  not_approved: "#dc2626",
};

const KNOWN_ERROR_TYPES: ErrorType[] = [
  "Low LOI",
  "High LOI",
  "OddHour",
  "DuplicatePhone",
  "Interwoven",
  "ShortGap",
  "Terminated",
  "Force Cancelled",
  "Outside LGA Boundary",
  "ClusteredInterview",
];

const isBrowser = typeof window !== "undefined";

type Props = {
  submissions: MapSubmission[];
  interviewers: string[];
  errorTypes: ErrorType[];
  showLabels?: boolean;
  lgaGeo?: FeatureCollection<Geometry, Record<string, unknown>>;
  overrides?: Record<string, StoredStatus>;
  onStatusPersist?: (id: string, record: StoredStatus) => void;
};

type DecoratedSubmission = MapSubmission & {
  combinedErrors: ErrorType[];
  autoFlags: ErrorType[];
  override?: StoredStatus;
};

type LeafletImageFn = (
  map: L.Map,
  callback: (error: unknown, canvas: HTMLCanvasElement) => void,
) => void;

const ensureLeafletImage = async (): Promise<LeafletImageFn> => {
  if (!isBrowser) {
    throw new Error("leaflet-image can only run in the browser");
  }
  const globalScope = window as unknown as { leafletImage?: LeafletImageFn };
  if (typeof globalScope.leafletImage === "function") {
    return globalScope.leafletImage;
  }

  const existingScript = document.querySelector<HTMLScriptElement>("script[data-leaflet-image]");
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener(
        "load",
        () => {
          if (typeof globalScope.leafletImage === "function") {
            resolve(globalScope.leafletImage);
          } else {
            reject(new Error("leaflet-image failed to initialise"));
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
      if (typeof globalScope.leafletImage === "function") {
        resolve(globalScope.leafletImage);
      } else {
        reject(new Error("leaflet-image failed to initialise"));
      }
    };
    script.onerror = (event) => reject(event);
    document.body.appendChild(script);
  });
};

const createMarkerIcon = (() => {
  const cache = new Map<QCStatus, L.DivIcon>();
  return (status: QCStatus) => {
    if (cache.has(status)) {
      return cache.get(status)!;
    }
    const icon = L.divIcon({
      className: "qc-marker",
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      html: `<div style="width:16px;height:16px;border-radius:50%;background:${STATUS_COLORS[status]};border:2px solid white;box-shadow:0 2px 6px rgba(15,23,42,0.35);"></div>`,
    });
    cache.set(status, icon);
    return icon;
  };
})();

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const normalizeError = (error: string): ErrorType | null => {
  const match = KNOWN_ERROR_TYPES.find((item) => item.toLowerCase() === error.toLowerCase());
  return match ?? null;
};

const getFeatureName = (properties: Record<string, unknown> = {}): string | undefined => {
  const keys = ["LGA", "lga", "name", "NAME", "LGAName", "lga_name"];
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
};

const InteractiveMap = ({
  submissions,
  interviewers,
  errorTypes,
  showLabels: initialShowLabels = false,
  lgaGeo,
  overrides,
  onStatusPersist,
}: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null);
  const labelLayerRef = useRef<L.LayerGroup | null>(null);
  const polygonLayerRef = useRef<L.GeoJSON | null>(null);

  const [errorFilter, setErrorFilter] = useState<ErrorType | "all">("all");
  const [interviewerFilter, setInterviewerFilter] = useState<string>("all");
  const [labelsVisible, setLabelsVisible] = useState<boolean>(Boolean(initialShowLabels));

  const {
    openForceAction,
    modal,
    overrides: localOverrides,
  } = useSingleForceAction(onStatusPersist);

  const decoratedSubmissions = useMemo<DecoratedSubmission[]>(() => {
    const knownErrors = new Set<ErrorType>([...KNOWN_ERROR_TYPES, ...errorTypes]);
    const appliedOverrides = overrides ?? localOverrides;
    return submissions.map((submission) => {
      const candidate = submission as MapSubmission & { autoFlags?: ErrorType[] };
      const autoFlagsRaw = Array.isArray(candidate.autoFlags) ? candidate.autoFlags : [];
      const autoFlags = autoFlagsRaw
        .map((item) => (typeof item === "string" ? normalizeError(item) : null))
        .filter((item): item is ErrorType => Boolean(item));
      const combined = new Set<ErrorType>();
      submission.errorTypes.forEach((error) => {
        if (knownErrors.has(error)) {
          combined.add(error);
        }
      });
      autoFlags.forEach((error) => combined.add(error));
      const override = appliedOverrides[submission.id];
      return {
        ...submission,
        status: override?.status ?? submission.status,
        combinedErrors: Array.from(combined),
        autoFlags,
        override,
      };
    });
  }, [errorTypes, localOverrides, overrides, submissions]);

  const filteredSubmissions = useMemo(() => {
    return decoratedSubmissions.filter((submission) => {
      if (errorFilter !== "all" && !submission.combinedErrors.includes(errorFilter)) {
        return false;
      }
      if (interviewerFilter !== "all" && submission.interviewerId !== interviewerFilter) {
        return false;
      }
      return true;
    });
  }, [decoratedSubmissions, errorFilter, interviewerFilter]);

  useEffect(() => {
    if (!isBrowser) return;
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      preferCanvas: true,
      center: [9.07, 7.48],
      zoom: 6,
      maxZoom: 18,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const clusterGroup = L.markerClusterGroup();
    clusterGroup.addTo(map);

    mapRef.current = map;
    clusterGroupRef.current = clusterGroup;

    setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => {
      clusterGroup.clearLayers();
      clusterGroup.remove();
      map.remove();
      mapRef.current = null;
      clusterGroupRef.current = null;
      if (polygonLayerRef.current) {
        polygonLayerRef.current.remove();
        polygonLayerRef.current = null;
      }
      if (labelLayerRef.current) {
        labelLayerRef.current.remove();
        labelLayerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const clusterGroup = clusterGroupRef.current;
    if (!map || !clusterGroup) return;

    clusterGroup.clearLayers();

    filteredSubmissions.forEach((submission) => {
      if (typeof submission.lat !== "number" || typeof submission.lng !== "number") return;

      const marker = L.marker([submission.lat, submission.lng], {
        icon: createMarkerIcon(submission.status),
      });

      const errors = submission.combinedErrors.length
        ? `<ul style="padding-left:18px;margin:4px 0 0;">${submission.combinedErrors
            .map((error) => `<li>${error}</li>`)
            .join("")}</ul>`
        : "<p style=\"margin:4px 0 0;\">No flags</p>";

      const autoFlags = submission.autoFlags.length
        ? `<div style="margin-top:8px;font-size:12px;color:#2563eb;">Auto flags: ${submission.autoFlags.join(", ")}</div>`
        : "";

      const overrideDetails = submission.override
        ? `<div style="margin-top:8px;padding:8px;border-radius:6px;background:rgba(37,99,235,0.08);font-size:12px;">` +
          `<div><strong>QC Officer:</strong> ${submission.override.officer}</div>` +
          `<div><strong>Comment:</strong> ${submission.override.comment}</div>` +
          `<div><strong>Updated:</strong> ${formatTimestamp(submission.override.timestamp)}</div>` +
          `</div>`
        : "";

      const popupHtml = `
        <div style="min-width:240px;font-family:Inter,system-ui,sans-serif;">
          <h3 style="margin:0 0 8px;font-size:16px;font-weight:600;">Submission ${submission.id}</h3>
          <div style="font-size:13px;line-height:1.5;">
            <div><strong>Interviewer:</strong> ${submission.interviewerId} (${submission.interviewerName})</div>
            <div><strong>LGA:</strong> ${submission.lga || "Unknown"}</div>
            <div><strong>Status:</strong> <span style="color:${STATUS_COLORS[submission.status]};font-weight:600;">${
              submission.status === "approved" ? "Approved" : "Not Approved"
            }</span></div>
            <div><strong>Timestamp:</strong> ${formatTimestamp(submission.timestamp)}</div>
            <div style="margin-top:8px;"><strong>Flags:</strong>${errors}</div>
            ${autoFlags}
            ${overrideDetails}
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
            <button type="button" data-action="approve" style="flex:1;min-width:120px;padding:8px 12px;border-radius:6px;border:1px solid #16a34a;background:#16a34a;color:white;font-weight:600;cursor:pointer;">Force Approve</button>
            <button type="button" data-action="cancel" style="flex:1;min-width:120px;padding:8px 12px;border-radius:6px;border:1px solid #dc2626;background:white;color:#dc2626;font-weight:600;cursor:pointer;">Force Cancel</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, { maxWidth: 320 });

      const handlePopupOpen = (event: L.PopupEvent) => {
        const element = event.popup.getElement();
        if (!element) return;
        const attach = (selector: string, status: QCStatus) => {
          const button = element.querySelector<HTMLButtonElement>(selector);
          if (!button) return;
          const listener = (ev: Event) => {
            ev.preventDefault();
            openForceAction(submission, status);
          };
          button.addEventListener("click", listener);
          marker.once("popupclose", () => {
            button.removeEventListener("click", listener);
          });
        };
        attach("button[data-action=approve]", "approved");
        attach("button[data-action=cancel]", "not_approved");
      };

      marker.on("popupopen", handlePopupOpen);

      clusterGroup.addLayer(marker);
    });

    if (filteredSubmissions.length > 0) {
      const points = filteredSubmissions
        .filter((submission) => typeof submission.lat === "number" && typeof submission.lng === "number")
        .map((submission) => [submission.lat as number, submission.lng as number]) as [number, number][];
      if (points.length > 0) {
        const bounds = L.latLngBounds(points);
        if (lgaGeo) {
          const polygonBounds = L.geoJSON(lgaGeo).getBounds();
          if (polygonBounds.isValid()) {
            bounds.extend(polygonBounds);
          }
        }
        map.fitBounds(bounds.pad(0.15));
      }
    }
  }, [filteredSubmissions, lgaGeo, openForceAction]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (polygonLayerRef.current) {
      polygonLayerRef.current.remove();
      polygonLayerRef.current = null;
    }

    if (!lgaGeo) return;

    const polygonLayer = L.geoJSON(lgaGeo, {
      style: {
        color: "#1d4ed8",
        weight: 1,
        fillOpacity: 0.04,
      },
    });
    polygonLayer.addTo(map);
    polygonLayerRef.current = polygonLayer;
  }, [lgaGeo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (labelLayerRef.current) {
      labelLayerRef.current.remove();
      labelLayerRef.current = null;
    }

    if (!lgaGeo || !labelsVisible) return;

    const labelLayer = L.layerGroup();
    lgaGeo.features.forEach((feature) => {
      if (!feature.geometry) return;
      const geometry = feature.geometry as Geometry;
      if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") return;
      const [lng, lat] = featureCentroid(geometry as Polygon | MultiPolygon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          className: "lga-label-marker",
          html: "",
          iconSize: [0, 0],
        }),
      });
      marker.bindTooltip(getFeatureName(feature.properties ?? {}) ?? "", {
        permanent: true,
        direction: "center",
        className: "lga-label",
      });
      labelLayer.addLayer(marker);
    });
    labelLayer.addTo(map);
    labelLayerRef.current = labelLayer;
  }, [labelsVisible, lgaGeo]);

  const handleExport = useCallback(async () => {
    if (!mapRef.current) return;
    try {
      const leafletImage = await ensureLeafletImage();
      leafletImage(mapRef.current, (error, canvas) => {
        if (error || !canvas) {
          console.error("Failed to render map", error);
          return;
        }
        canvas.toBlob((blob) => {
          if (!blob) return;
          const link = document.createElement("a");
          const stamp = new Date();
          const pad = (value: number) => value.toString().padStart(2, "0");
          const filename = `map_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(
            stamp.getHours(),
          )}${pad(stamp.getMinutes())}.png`;
          const url = URL.createObjectURL(blob);
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        });
      });
    } catch (error) {
      console.error("Unable to export map", error);
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-600" htmlFor="error-filter">
            Error filter
          </label>
          <select
            id="error-filter"
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
            value={errorFilter}
            onChange={(event) => setErrorFilter(event.target.value as ErrorType | "all")}
          >
            <option value="all">All errors</option>
            {errorTypes.map((error) => (
              <option key={error} value={error}>
                {error}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-600" htmlFor="interviewer-filter">
            Interviewer
          </label>
          <select
            id="interviewer-filter"
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm shadow-sm focus:border-slate-500 focus:outline-none"
            value={interviewerFilter}
            onChange={(event) => setInterviewerFilter(event.target.value)}
          >
            <option value="all">All interviewers</option>
            {interviewers.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" onClick={() => setLabelsVisible((value) => !value)}>
          {labelsVisible ? "Hide LGA Labels" : "Show LGA Labels"}
        </Button>
      </div>
      <div className="relative">
        <div ref={containerRef} className="h-[640px] w-full rounded-lg border border-slate-200" />
        <div className="absolute right-4 top-4 z-[1000]">
          <Button type="button" variant="secondary" onClick={handleExport}>
            Export Map PNG
          </Button>
        </div>
      </div>
      {modal}
    </div>
  );
};

export { InteractiveMap };
export default InteractiveMap;
