import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Eye, EyeOff, MapPin } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { normaliseErrorType } from "@/lib/errorTypes";
import { formatErrorLabel } from "@/lib/utils";
import { normalizeMapMetadata, type NormalizedMapMetadata } from "@/lib/mapMetadata";
import ogunLgaGeoJsonUrl from "@/assets/ogun-lga.geojson?url";

const defaultIconPrototype = L.Icon.Default.prototype as unknown as {
  _getIconUrl?: unknown;
};
delete defaultIconPrototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Submission {
  id: string;
  lat: number;
  lng: number;
  interviewerId: string;
  interviewerLabel?: string;
  lga: string;
  state: string;
  errorTypes: string[];
  qcFlags?: string[];
  otherFlags?: string[];
  timestamp: string;
  status: "approved" | "not_approved";
  approvalLabel?: string | null;
  approvalSource?: string | null;
  pillarPath: "treatment" | "control" | "unknown" | null;
  pillarAssignment: string | null;
  directions: string | null;
  respondentName?: string | null;
  respondentPhone?: string | null;
  respondentGender?: string | null;
  respondentAge?: string | null;
  ward?: string | null;
  community?: string | null;
  consent?: string | null;
  qcStatus?: string | null;
}

interface InterviewerOption {
  id: string;
  name?: string;
  label?: string;
}

interface InteractiveMapProps {
  submissions: Submission[];
  interviewers?: InterviewerOption[];
  errorTypes?: string[];
  metadata?: NormalizedMapMetadata;
}

type ColorMode = "path" | "approval";

const getPathMetadata = (submission: Submission) => {
  switch (submission.pillarPath) {
    case "treatment":
      return {
        color: "#8b5cf6",
        label: "Treatment path",
      } as const;
    case "control":
      return {
        color: "#f97316",
        label: "Control path",
      } as const;
    case "unknown":
      return {
        color: "#0ea5e9",
        label: "Unqualified respondent",
      } as const;
    default:
      return {
        color: "#94a3b8",
        label: "Path not specified",
      } as const;
  }
};

const getApprovalMetadata = (submission: Submission) => {
  const isApproved = submission.status === "approved";
  return {
    color: isApproved ? "#16a34a" : "#dc2626",
    label: isApproved ? "Approved" : "Not Approved",
  } as const;
};

const getMarkerColor = (submission: Submission, mode: ColorMode) =>
  mode === "approval" ? getApprovalMetadata(submission).color : getPathMetadata(submission).color;

const formatColumnLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const MARKER_DIAMETER = 18;
const MARKER_BORDER_WIDTH = 3;
const MARKER_TOTAL_SIZE = MARKER_DIAMETER + MARKER_BORDER_WIDTH * 2;

const createCustomIcon = (submission: Submission, mode: ColorMode) => {
  const color = getMarkerColor(submission, mode);
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color: ${color}; width: ${MARKER_DIAMETER}px; height: ${MARKER_DIAMETER}px; border-radius: 50%; border: ${MARKER_BORDER_WIDTH}px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>`,
    iconSize: [MARKER_TOTAL_SIZE, MARKER_TOTAL_SIZE],
    iconAnchor: [MARKER_TOTAL_SIZE / 2, MARKER_TOTAL_SIZE / 2],
  });
};

const escapeHtml = (value: unknown) => {
  const text = value == null ? "" : String(value);

  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const sanitizeFilePrefix = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-") || "map-export";

const normaliseText = (value: string) => value.trim().toLowerCase();

const getFeatureLgaName = (
  feature: Feature<Geometry, Record<string, unknown>>,
): string => {
  const properties = feature.properties ?? {};
  const candidate =
    (properties?.lganame as string | undefined) ??
    (properties?.LGA as string | undefined) ??
    (properties?.LGA_NAME as string | undefined) ??
    (properties?.name as string | undefined) ??
    "";

  return typeof candidate === "string" ? candidate : "";
};

const filterFeaturesByLga = (
  features: Feature<Geometry, Record<string, unknown>>[],
  lga: string,
) => {
  const target = normaliseText(lga);
  if (!target) {
    return [];
  }

  return features.filter((feature) => normaliseText(getFeatureLgaName(feature)) === target);
};

const isLikelyUrl = (value: string) => /^https?:\/\//i.test(value.trim());

const waitForTileLayerToRender = async (tileLayer: L.TileLayer | null) => {
  if (!tileLayer) {
    return;
  }

  const internalTileLayer = tileLayer as L.TileLayer & { _loading?: boolean };

  if (!internalTileLayer._loading) {
    return;
  }

  await new Promise<void>((resolve) => {
    let resolved = false;

    const cleanup = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      tileLayer.off("load", handleLoad);
      tileLayer.off("tileload", handleTileLoad);
      resolve();
    };

    const handleLoad = () => {
      cleanup();
    };

    const handleTileLoad = () => {
      if (!internalTileLayer._loading) {
        cleanup();
      }
    };

    tileLayer.on("load", handleLoad);
    tileLayer.on("tileload", handleTileLoad);

    window.setTimeout(() => {
      cleanup();
    }, 1500);
  });
};

const createPopupHtml = (submission: Submission): string => {
  const statusLabel = submission.status === "approved" ? "Approved" : "Not Approved";
  const statusColor = submission.status === "approved" ? "#16a34a" : "#dc2626";
  const pathMetadata = getPathMetadata(submission);
  const enumeratorLabel = escapeHtml(
    submission.interviewerLabel && submission.interviewerLabel.length > 0
      ? submission.interviewerLabel
      : `Enumerator ${submission.interviewerId}`,
  );
  const stateLabel = escapeHtml(submission.state);
  const lgaLabel = escapeHtml(submission.lga);
  const wardLabel = submission.ward ? escapeHtml(submission.ward) : null;
  const communityLabel = submission.community ? escapeHtml(submission.community) : null;
  const pathLabel = escapeHtml(pathMetadata.label);
  const approvalLabel = escapeHtml(submission.approvalLabel ?? statusLabel);
  const approvalSourceLabel = escapeHtml(
    submission.approvalSource ? formatColumnLabel(submission.approvalSource) : "Approval",
  );
  const pillarAssignment = submission.pillarAssignment ? escapeHtml(submission.pillarAssignment) : null;
  const respondentPhone = submission.respondentPhone ? escapeHtml(submission.respondentPhone) : null;
  const respondentAge = submission.respondentAge ? escapeHtml(submission.respondentAge) : null;
  const rawDirection = submission.directions?.trim() ?? "";
  const directionsHtml =
    rawDirection.length > 0 && isLikelyUrl(rawDirection)
      ? `<a href="${escapeHtml(rawDirection)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;font-weight:600;text-decoration:underline;">Direction link</a>`
      : rawDirection.length > 0
        ? escapeHtml(rawDirection)
        : "<span>Direction link (unavailable)</span>";

  const qcFlags = Array.from(new Set(submission.qcFlags ?? [])).map((code) => formatErrorLabel(code));
  const qcFlagSet = new Set(submission.qcFlags ?? []);
  const otherFlags = Array.from(
    new Set(
      (submission.otherFlags && submission.otherFlags.length > 0
        ? submission.otherFlags
        : submission.errorTypes.filter((code) => !qcFlagSet.has(code))) ?? [],
    ),
  ).map((code) => formatErrorLabel(code));

  const renderFlagList = (title: string, items: string[], options?: { inline?: boolean }) => {
    if (!items.length) return "";

    if (options?.inline) {
      return `
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:13px;line-height:1.5;">
          <span style="font-weight:700;color:#0f172a;">${escapeHtml(title)}:</span>
          <span style="color:#0f172a;">${items.map((item) => `<span style="font-weight:600;">${escapeHtml(item)}</span>`).join(", ")}</span>
        </div>
      `;
    }

    return `
      <div style="display:flex;flex-direction:column;gap:6px;">
        <div style="font-weight:700;color:#0f172a;">${escapeHtml(title)} (${items.length})</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${items
            .map(
              (item) =>
                `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:9999px;background:#e0f2fe;color:#0f172a;font-weight:600;font-size:12px;">${escapeHtml(item)}</span>`,
            )
            .join("")}
        </div>
      </div>
    `;
  };

  const flagsSection = [
    renderFlagList("QC Flags", qcFlags, { inline: true }),
    renderFlagList("Other Flags", otherFlags),
  ]
    .filter((section) => section.length > 0)
    .join("\n");

  const buildDetailRow = (label: string, value: string | null, { isHtml = false } = {}) =>
    value && value.length > 0
      ? `<div style="display:flex;gap:8px;line-height:1.5;">
            <span style="min-width:110px;font-weight:700;color:#0f172a;">${escapeHtml(label)}:</span>
            <span style="color:#0b172a;">${isHtml ? value : escapeHtml(value)}</span>
         </div>`
      : "";

  const details = [
    `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <span style="font-weight:700;color:#0f172a;">${approvalSourceLabel}:</span>
        <span style="padding:6px 10px;border-radius:9999px;background:${statusColor}1a;color:${statusColor};font-weight:700;">${approvalLabel}</span>
     </div>`,
    buildDetailRow("Pillar Path", pathLabel, { isHtml: true }),
    buildDetailRow("Pillar Assignment", pillarAssignment),
    buildDetailRow("Phone", respondentPhone),
    buildDetailRow("Age", respondentAge),
    buildDetailRow("Ward", wardLabel),
    buildDetailRow("Community", communityLabel),
    buildDetailRow("Directions", directionsHtml, { isHtml: true }),
  ]
    .filter((row) => row.length > 0)
    .join("\n");

  return `
    <div style="min-width:280px;max-width:360px;display:flex;flex-direction:column;gap:12px;font-size:14px;font-family:Inter,system-ui,sans-serif;color:#0f172a;padding:12px;border-radius:14px;background:linear-gradient(135deg,#ffffff 0%,#f8fbff 100%);box-shadow:0 12px 30px rgba(0,0,0,0.12);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="font-weight:800;font-size:15px;color:${pathMetadata.color};">${enumeratorLabel}</div>
          <div style="font-size:12px;color:#475569;">${stateLabel ? `${stateLabel} · ` : ""}${lgaLabel}</div>
        </div>
        <span style="padding:6px 10px;border-radius:10px;background:${pathMetadata.color}18;color:${pathMetadata.color};font-weight:700;font-size:12px;">${pathLabel}</span>
      </div>
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#fff;display:flex;flex-direction:column;gap:8px;">
        ${details}
      </div>
      ${flagsSection ? `<div style="border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;background:#f8fafc;display:flex;flex-direction:column;gap:10px;">${flagsSection}</div>` : ""}
    </div>
  `;
};

export function InteractiveMap({
  submissions,
  interviewers = [],
  errorTypes = [],
  metadata,
}: InteractiveMapProps) {
  const normalizedMetadata = metadata ?? normalizeMapMetadata();
  const [selectedErrorType, setSelectedErrorType] = useState("all");
  const [selectedInterviewer, setSelectedInterviewer] = useState("all");
  const [selectedLga, setSelectedLga] = useState("all");
  const [colorMode, setColorMode] = useState<ColorMode>("path");
  const [showLgaLabels, setShowLgaLabels] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const labelLayerRef = useRef<L.LayerGroup | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [geoJsonFeatures, setGeoJsonFeatures] = useState<
    Feature<Geometry, Record<string, unknown>>[]
  >([]);
  const baseSubmissions = useMemo(() => (Array.isArray(submissions) ? submissions : []), [submissions]);
  const interviewerLookup = useMemo(() => {
    const map = new Map<string, InterviewerOption>();
    interviewers.forEach((option) => {
      map.set(option.id, option);
    });
    return map;
  }, [interviewers]);
  const availableLgas = useMemo(() => {
    const set = new Set<string>();
    baseSubmissions.forEach((submission) => {
      if (
        (selectedErrorType === "all" || submission.errorTypes.includes(selectedErrorType)) &&
        (selectedInterviewer === "all" || submission.interviewerId === selectedInterviewer)
      ) {
        if (submission.lga && submission.lga.trim().length > 0) {
          set.add(submission.lga);
        }
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [baseSubmissions, selectedErrorType, selectedInterviewer]);
  const availableErrorTypes = useMemo(() => {
    const set = new Set<string>();

    errorTypes
      .map((type) => normaliseErrorType(type).slug)
      .filter((slug) => slug.length > 0)
      .forEach((slug) => set.add(slug));

    baseSubmissions.forEach((submission) => {
      if (
        (selectedLga === "all" || submission.lga === selectedLga) &&
        (selectedInterviewer === "all" || submission.interviewerId === selectedInterviewer)
      ) {
        submission.errorTypes.forEach((type) => {
          const slug = normaliseErrorType(type).slug;
          if (slug.length > 0) {
            set.add(slug);
          }
        });
      }
    });

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [baseSubmissions, errorTypes, selectedInterviewer, selectedLga]);
  const availableInterviewers = useMemo(() => {
    const set = new Set<string>();
    baseSubmissions.forEach((submission) => {
      if (
        (selectedLga === "all" || submission.lga === selectedLga) &&
        (selectedErrorType === "all" || submission.errorTypes.includes(selectedErrorType))
      ) {
        if (submission.interviewerId && submission.interviewerId.trim().length > 0) {
          set.add(submission.interviewerId);
        }
      }
    });

    return Array.from(set)
      .sort((a, b) => a.localeCompare(b))
      .map((id) => {
        const option = interviewerLookup.get(id);
        if (option) {
          return option;
        }
        return { id, name: id, label: id } as InterviewerOption;
      });
  }, [baseSubmissions, interviewerLookup, selectedErrorType, selectedLga]);
  const visibleGeoJsonFeatures = useMemo(() => {
    if (selectedLga === "all") {
      return geoJsonFeatures;
    }
    return filterFeaturesByLga(geoJsonFeatures, selectedLga);
  }, [geoJsonFeatures, selectedLga]);

  const handleToggleLabels = () => {
    setShowLgaLabels((previous) => !previous);
  };

  const handleLgaChange = useCallback((value: string) => {
    setSelectedLga(value);
  }, []);

  useEffect(() => {
    if (selectedLga === "all") {
      return;
    }

    if (!availableLgas.includes(selectedLga)) {
      handleLgaChange("all");
    }
  }, [availableLgas, handleLgaChange, selectedLga]);

  useEffect(() => {
    if (selectedInterviewer === "all") {
      return;
    }

    if (!availableInterviewers.some((option) => option.id === selectedInterviewer)) {
      setSelectedInterviewer("all");
    }
  }, [availableInterviewers, selectedInterviewer]);

  useEffect(() => {
    if (selectedErrorType === "all") {
      return;
    }

    if (!availableErrorTypes.includes(selectedErrorType)) {
      setSelectedErrorType("all");
    }
  }, [availableErrorTypes, selectedErrorType]);

  const filteredSubmissions = useMemo(() => {
    return baseSubmissions.filter((submission) => {
      const matchesError =
        selectedErrorType === "all" || submission.errorTypes.includes(selectedErrorType);
      const matchesInterviewer =
        selectedInterviewer === "all" || submission.interviewerId === selectedInterviewer;
      const matchesLga = selectedLga === "all" || submission.lga === selectedLga;
      return matchesError && matchesInterviewer && matchesLga;
    });
  }, [baseSubmissions, selectedErrorType, selectedInterviewer, selectedLga]);

  const handleExportMap = useCallback(async () => {
    if (isExporting) {
      return;
    }

    if (typeof window === "undefined" || typeof document === "undefined") {
      console.warn("Map export is only available in the browser context.");
      return;
    }

    const mapElement = mapContainerRef.current;

    if (!mapElement) {
      console.warn("Map element is not ready for export.");
      return;
    }

    setIsExporting(true);

    try {
      await waitForTileLayerToRender(tileLayerRef.current);
      const { default: html2canvas } = await import("html2canvas");
      const background = window.getComputedStyle(mapElement).backgroundColor;
      const canvas = await html2canvas(mapElement, {
        useCORS: true,
        logging: false,
        backgroundColor:
          background && background !== "rgba(0, 0, 0, 0)" ? background : "#ffffff",
        scale: Math.max(window.devicePixelRatio || 1, 1),
        imageTimeout: 1500,
      });

      const dataUrl = canvas.toDataURL("image/png");
      const sanitizedPrefix = sanitizeFilePrefix(normalizedMetadata.exportFilenamePrefix);
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

      const anchor = document.createElement("a");
      anchor.href = dataUrl;
      anchor.download = `${sanitizedPrefix}-${timestamp}.png`;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (error) {
      console.error("Failed to export map image", error);
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, normalizedMetadata.exportFilenamePrefix]);

  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [7.15, 3.35],
        zoom: 8,
        scrollWheelZoom: true,
      });

      tileLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        crossOrigin: true,
      }).addTo(mapRef.current);

      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 300);
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      labelLayerRef.current = null;
      boundaryLayerRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const loadBoundary = async () => {
      try {
        let response: Response | null = null;

        try {
          response = await fetch(ogunLgaGeoJsonUrl);
        } catch (error) {
          console.warn("Bundled LGA boundary fetch failed, falling back to public asset", error);
        }

        if (!response || !response.ok) {
          response = await fetch("/ogun-lga.geojson").catch(() => null);
        }

        if (!response || !response.ok) return;

        const geoJson = (await response.json()) as FeatureCollection<Geometry, Record<string, unknown>>;

        setGeoJsonFeatures(geoJson.features ?? []);

        const layer = L.geoJSON(geoJson);
        const bounds = layer.getBounds();
        if (bounds.isValid() && mapRef.current) {
          mapRef.current.fitBounds(bounds, { padding: [32, 32] });
        }
        layer.remove();
      } catch (error) {
        console.error("Failed to load Ogun LGA boundaries", error);
      }
    };

    loadBoundary();
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    boundaryLayerRef.current?.remove();
    boundaryLayerRef.current = null;

    const featuresToRender = selectedLga === "all" ? geoJsonFeatures : visibleGeoJsonFeatures;

    if (!featuresToRender || featuresToRender.length === 0) {
      return;
    }

    const layer = L.geoJSON(
      { type: "FeatureCollection", features: featuresToRender },
      {
        style: () => {
          const isAll = selectedLga === "all";
          return {
            weight: isAll ? 1.8 : 3.2,
            color: isAll ? "#1e3a8a" : "#1d4ed8",
            opacity: 0.95,
            fillOpacity: isAll ? 0.12 : 0.22,
            fillColor: isAll ? "#c7d2fe" : "#93c5fd",
          };
        },
      },
    );

    layer.addTo(mapRef.current);
    layer.bringToBack();
    boundaryLayerRef.current = layer;
  }, [geoJsonFeatures, selectedLga, visibleGeoJsonFeatures]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!markerLayerRef.current) {
      markerLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const layer = markerLayerRef.current;
    layer.clearLayers();

    filteredSubmissions.forEach((submission) => {
      const marker = L.marker([submission.lat, submission.lng], {
        icon: createCustomIcon(submission, colorMode),
      });

      marker.bindPopup(createPopupHtml(submission));
      marker.addTo(layer);
    });
  }, [filteredSubmissions, colorMode]);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = mapRef.current;
    const boundaryBounds = boundaryLayerRef.current?.getBounds();

    if (
      selectedLga !== "all" &&
      boundaryBounds &&
      boundaryBounds.isValid()
    ) {
      map.fitBounds(boundaryBounds, { padding: [28, 28] });
      return;
    }

    const points = filteredSubmissions
      .map((submission) => {
        const { lat, lng } = submission;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return null;
        }
        return L.latLng(lat, lng);
      })
      .filter((value): value is ReturnType<typeof L.latLng> => value !== null);

    if (points.length === 0) {
      if (boundaryBounds && boundaryBounds.isValid()) {
        map.fitBounds(boundaryBounds, { padding: [32, 32] });
      } else {
        map.setView([7.15, 3.35], 8, { animate: true });
      }
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 13, { animate: true });
      return;
    }

    const bounds = L.latLngBounds(points);
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [32, 32] });
    }
  }, [filteredSubmissions, selectedLga, selectedErrorType, selectedInterviewer]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!showLgaLabels) {
      if (labelLayerRef.current) {
        labelLayerRef.current.clearLayers();
        labelLayerRef.current.remove();
        labelLayerRef.current = null;
      }
      return;
    }

    if (!labelLayerRef.current) {
      labelLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const layer = labelLayerRef.current;
    layer.clearLayers();

    const addLabel = (name: string, center: L.LatLngExpression) => {
      const icon = L.divIcon({
        className: "lga-label",
        html: `<div>${name}</div>`,
        iconSize: [0, 0],
      });

      L.marker(center, { icon }).addTo(layer);
    };

    if (geoJsonFeatures.length > 0) {
      const featuresForLabels =
        selectedLga === "all" || visibleGeoJsonFeatures.length === 0
          ? geoJsonFeatures
          : visibleGeoJsonFeatures;

      featuresForLabels.forEach((feature) => {
        const lgaName = getFeatureLgaName(feature) || "Unknown";
        const featureLayer = L.geoJSON(feature);
        addLabel(lgaName, featureLayer.getBounds().getCenter());
        featureLayer.remove();
      });

      return;
    }

    const lgaCenters = filteredSubmissions.reduce(
      (acc, sub) => {
        if (!acc[sub.lga]) {
          acc[sub.lga] = { lat: 0, lng: 0, count: 0 };
        }

        acc[sub.lga].lat += sub.lat;
        acc[sub.lga].lng += sub.lng;
        acc[sub.lga].count += 1;
        return acc;
      },
      {} as Record<string, { lat: number; lng: number; count: number }>
    );

    Object.entries(lgaCenters).forEach(([lga, data]) => {
      const avgLat = data.lat / data.count;
      const avgLng = data.lng / data.count;
      addLabel(lga, [avgLat, avgLng]);
    });
  }, [filteredSubmissions, geoJsonFeatures, selectedLga, showLgaLabels, visibleGeoJsonFeatures]);

  useEffect(() => {
    if (!mapRef.current) return;
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 200);
  }, [filteredSubmissions.length]);

  const totalRecords = baseSubmissions.length;
  const trimmedMetadataTitle =
    typeof normalizedMetadata.title === "string" ? normalizedMetadata.title.trim() : "";
  const trimmedMetadataSubtitle =
    typeof normalizedMetadata.subtitle === "string" ? normalizedMetadata.subtitle.trim() : "";
  const headerSubtitle =
    trimmedMetadataSubtitle.length > 0
      ? trimmedMetadataSubtitle
      : trimmedMetadataTitle && trimmedMetadataTitle.toLowerCase() !== "live submission map"
        ? trimmedMetadataTitle
        : "";
  const defaultSubtitle =
    "Explore live submissions on the map, filter by interviewers or QC flags, and download the current view.";
  const resolvedSubtitle = headerSubtitle.length > 0 ? headerSubtitle : defaultSubtitle;

  return (
    <section className="space-y-6">
      <Card className="fade-in overflow-hidden border-none shadow-lg shadow-primary/15">
        <CardHeader className="border-b bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-foreground/20 text-primary-foreground">
                <MapPin className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-left text-lg font-semibold text-primary-foreground">
                  Live Submission Map
                </CardTitle>
                <CardDescription className="text-primary-foreground/90">
                  {resolvedSubtitle}
                </CardDescription>
              </div>
            </div>
            <div className="text-sm font-medium text-primary-foreground/90">
              Total records: {totalRecords.toLocaleString()}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 bg-card/60 p-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Select value={selectedLga} onValueChange={handleLgaChange}>
              <SelectTrigger className="w-full min-w-[180px]">
                <SelectValue placeholder="All LGAs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All LGAs</SelectItem>
                {availableLgas.map((lga) => (
                  <SelectItem key={lga} value={lga}>
                    {lga}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedErrorType} onValueChange={setSelectedErrorType}>
              <SelectTrigger className="w-full min-w-[200px]">
                <SelectValue placeholder="All Flags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Flags</SelectItem>
                {availableErrorTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatErrorLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedInterviewer} onValueChange={setSelectedInterviewer}>
              <SelectTrigger className="w-full min-w-[220px]">
                <SelectValue placeholder="All Interviewers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Interviewers</SelectItem>
                {availableInterviewers.map((interviewer) => (
                  <SelectItem key={interviewer.id} value={interviewer.id}>
                    <span className="font-medium">
                      {interviewer.label ?? interviewer.name ?? interviewer.id}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative h-[500px] w-full overflow-hidden rounded-xl border bg-background">
            <div ref={mapContainerRef} className="sticky top-20 z-0 h-full w-full" style={{ zIndex: 0 }} />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {(colorMode === "path"
              ? [
                  { label: "Treatment path (B2 = Yes)", color: "#8b5cf6" },
                  { label: "Control path (B2 = No)", color: "#f97316" },
                  { label: "Path unavailable", color: "#0ea5e9" },
                ]
              : [
                  { label: "Approved", color: "#16a34a" },
                  { label: "Not Approved", color: "#dc2626" },
                ]).map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span
                  className="inline-flex h-3 w-3 rounded-full border border-white shadow"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:gap-6">
            <div className="flex flex-1 flex-col gap-1">
              <span>
                Showing {filteredSubmissions.length.toLocaleString()} of {totalRecords.toLocaleString()} records
              </span>
            </div>
            <div className="flex flex-1 flex-col items-center gap-3 md:flex-row md:justify-center">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Color mode</span>
              <ToggleGroup
                type="single"
                value={colorMode}
                onValueChange={(value) => {
                  if (value === "path" || value === "approval") {
                    setColorMode(value);
                  }
                }}
                className="rounded-md border bg-background p-1"
                variant="outline"
                size="sm"
              >
                <ToggleGroupItem value="approval" className="px-3 py-1 text-xs font-medium uppercase tracking-wide">
                  Approval
                </ToggleGroupItem>
                <ToggleGroupItem value="path" className="px-3 py-1 text-xs font-medium uppercase tracking-wide">
                  Path
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex flex-1 flex-col items-center gap-2 md:flex-row md:justify-end">
              <Button
                onClick={handleExportMap}
                disabled={isExporting}
                size="sm"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 md:w-auto"
              >
                <Download className="mr-2 h-4 w-4" /> {isExporting ? "Exporting…" : "Export Map"}
              </Button>
              <Button
                onClick={handleToggleLabels}
                variant="outline"
                size="sm"
                className="w-full md:w-auto"
              >
                {showLgaLabels ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                {showLgaLabels ? "Hide LGA Labels" : "Show LGA Labels"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
