import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatErrorLabel } from "@/lib/utils";
import type { NormalizedMapMetadata } from "@/lib/mapMetadata";
import { SectionHeader } from "./SectionHeader";
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
  // Names no longer used anywhere
  lga: string;
  state: string;
  errorTypes: string[];
  timestamp: string;
  status: "approved" | "not_approved";
  ogstepPath: "treatment" | "control" | "unknown";
  ogstepResponse: string | null;
  directions: string | null;
}

interface InterviewerOption {
  id: string;
  name?: string;
  label?: string;
}

interface InteractiveMapProps {
  submissions: Submission[];
  interviewers: InterviewerOption[];
  errorTypes: string[];
  lgas: string[];
  metadata: NormalizedMapMetadata;
}

type ColorMode = "path" | "approval";

const getPathMetadata = (submission: Submission) => {
  switch (submission.ogstepPath) {
    case "treatment":
      return {
        color: "#2563eb",
        label: "Treatment path",
      } as const;
    case "control":
      return {
        color: "#22c55e",
        label: "Control path",
      } as const;
    default:
      return {
        color: "#6b7280",
        label: "Path unavailable",
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

const createCustomIcon = (submission: Submission, mode: ColorMode) => {
  const color = getMarkerColor(submission, mode);
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sanitizeFilePrefix = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-") || "map-export";

const inlineComputedStyles = (source: Element, target: Element) => {
  const computedStyle = window.getComputedStyle(source);
  const styleString = Array.from(computedStyle)
    .map((property) => `${property}:${computedStyle.getPropertyValue(property)};`)
    .join("");

  target.setAttribute("style", styleString);

  Array.from(source.childNodes).forEach((child, index) => {
    const targetChild = target.childNodes[index];
    if (child.nodeType === Node.ELEMENT_NODE && targetChild?.nodeType === Node.ELEMENT_NODE) {
      inlineComputedStyles(child as Element, targetChild as Element);
    }
  });
};

const cloneNodeWithStyles = (node: HTMLElement) => {
  const clone = node.cloneNode(true) as HTMLElement;
  inlineComputedStyles(node, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  clone.querySelectorAll("img").forEach((img) => {
    img.setAttribute("crossorigin", "anonymous");
  });
  return clone;
};

const renderNodeToPng = async (node: HTMLElement): Promise<string> => {
  const width = node.clientWidth;
  const height = node.clientHeight;

  if (width === 0 || height === 0) {
    throw new Error("Map area has no size to export");
  }

  const clone = cloneNodeWithStyles(node);
  const serialized = new XMLSerializer().serializeToString(clone);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">\n  <foreignObject width="100%" height="100%">${serialized}</foreignObject>\n</svg>`;
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("Unable to create canvas context"));
            return;
          }

          const background = window.getComputedStyle(node).backgroundColor;
          const fill = background && background !== "rgba(0, 0, 0, 0)" ? background : "#ffffff";
          context.fillStyle = fill;
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      };
      image.onerror = () => {
        reject(new Error("Failed to render map for export"));
      };
      image.src = url;
    });

    return dataUrl;
  } finally {
    URL.revokeObjectURL(url);
  }
};

const createPopupHtml = (submission: Submission): string => {
  const statusLabel = submission.status === "approved" ? "Approved" : "Not Approved";
  const statusColor = submission.status === "approved" ? "#16a34a" : "#dc2626";
  const pathMetadata = getPathMetadata(submission);
  const enumeratorLabel = escapeHtml(`Enumerator ${submission.interviewerId}`);
  const lgaLabel = escapeHtml(submission.lga);
  const timestampLabel = escapeHtml(submission.timestamp);
  const pathLabel = escapeHtml(pathMetadata.label);
  const statusLabelEscaped = escapeHtml(statusLabel);
  const directionsHtml = submission.directions
    ? `<a href="${escapeHtml(submission.directions)}" target="_blank" rel="noopener noreferrer" style="color:#2563eb;font-weight:600;text-decoration:underline;">Location</a>`
    : "<span>Not provided</span>";
  const errorsSection =
    submission.errorTypes.length
      ? `<div style="margin-top:8px;">
           <div style="font-weight:600;">Error Types:</div>
           <ul style="margin:6px 0 0 16px; padding:0; font-size:12px;">
             ${submission.errorTypes
               .map((e) => `<li>${escapeHtml(formatErrorLabel(e))}</li>`)
               .join("")}
           </ul>
         </div>`
      : "";

  return `
    <div style="min-width:220px;display:flex;flex-direction:column;gap:8px;font-size:14px;font-family:Inter,system-ui,sans-serif;">
      <div style="display:flex;flex-direction:column;gap:2px;">
        <div style="font-weight:700;color:#2563eb;">${enumeratorLabel}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;">
        <div><span style="font-weight:600;">LGA:</span> ${lgaLabel}</div>
        <div><span style="font-weight:600;">Directions:</span> ${directionsHtml}</div>
        <div><span style="font-weight:600;">OGSTEP Path:</span> <span style="font-weight:700;">${pathLabel}</span></div>
        <div><span style="font-weight:600;">Status:</span> <span style="font-weight:700;color:${statusColor};">${statusLabelEscaped}</span></div>
        <div><span style="font-weight:600;">Submitted:</span> ${timestampLabel}</div>
      </div>
      ${errorsSection}
    </div>
  `;
};

export function InteractiveMap({ submissions, interviewers, errorTypes, lgas, metadata }: InteractiveMapProps) {
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
  const [geoJsonFeatures, setGeoJsonFeatures] = useState<
    Feature<Geometry, Record<string, unknown>>[]
  >([]);

  const handleToggleLabels = () => {
    setShowLgaLabels((previous) => !previous);
  };

  useEffect(() => {
    if (selectedLga === "all") {
      return;
    }

    if (!lgas.includes(selectedLga)) {
      setSelectedLga("all");
    }
  }, [lgas, selectedLga]);

  useEffect(() => {
    if (selectedInterviewer === "all") {
      return;
    }

    if (!interviewers.some((option) => option.id === selectedInterviewer)) {
      setSelectedInterviewer("all");
    }
  }, [interviewers, selectedInterviewer]);

  const filteredSubmissions = useMemo(() => {
    return submissions
      .filter((submission) => submission.ogstepPath !== "unknown")
      .filter((submission) => {
        const matchesError =
          selectedErrorType === "all" || submission.errorTypes.includes(selectedErrorType);
        const matchesInterviewer =
          selectedInterviewer === "all" || submission.interviewerId === selectedInterviewer;
        const matchesLga = selectedLga === "all" || submission.lga === selectedLga;
        return matchesError && matchesInterviewer && matchesLga;
      });
  }, [submissions, selectedErrorType, selectedInterviewer, selectedLga]);

  const handleExportMap = useCallback(async () => {
    if (isExporting) {
      return;
    }

    if (typeof window === "undefined" || typeof document === "undefined") {
      console.warn("Map export is only available in the browser context.");
      return;
    }

    const container = mapContainerRef.current;
    const mapElement = container?.querySelector(".leaflet-container") as HTMLElement | null;

    if (!container || !mapElement) {
      console.warn("Map element is not ready for export.");
      return;
    }

    setIsExporting(true);

    try {
      const dataUrl = await renderNodeToPng(mapElement);
      const sanitizedPrefix = sanitizeFilePrefix(metadata.exportFilenamePrefix);
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
  }, [isExporting, metadata.exportFilenamePrefix]);

  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [7.15, 3.35],
        zoom: 8,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
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

        boundaryLayerRef.current?.remove();
        boundaryLayerRef.current = L.geoJSON(geoJson).addTo(mapRef.current!);

        boundaryLayerRef.current.bringToBack();

        setGeoJsonFeatures(geoJson.features ?? []);

        const bounds = boundaryLayerRef.current.getBounds();
        if (bounds.isValid()) {
          mapRef.current!.fitBounds(bounds, { padding: [32, 32] });
        }
      } catch (error) {
        console.error("Failed to load Ogun LGA boundaries", error);
      }
    };

    loadBoundary();
  }, []);

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
      const boundaryBounds = boundaryLayerRef.current?.getBounds();
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
      geoJsonFeatures.forEach((feature) => {
        const { properties } = feature;
        const lgaName =
          (properties?.lganame as string | undefined) ??
          (properties?.LGA as string | undefined) ??
          (properties?.name as string | undefined) ??
          "Unknown";

        const featureLayer = L.geoJSON(feature);
        addLabel(lgaName, featureLayer.getBounds().getCenter());
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
  }, [filteredSubmissions, geoJsonFeatures, showLgaLabels]);

  useEffect(() => {
    if (!mapRef.current) return;
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 200);
  }, [filteredSubmissions.length]);

  return (
    <section className="space-y-4">
      <SectionHeader title={metadata.title} subtitle={metadata.subtitle ?? undefined} />
      <Card className="fade-in">
        <CardHeader className="flex flex-col gap-4 border-b bg-muted/30 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 self-start">
            <MapPin className="h-5 w-5 text-primary" />
            <CardTitle className="text-left text-base font-semibold">Live Submission Map</CardTitle>
          </div>
          <div className="flex flex-nowrap items-end gap-3 overflow-x-auto">
            <Select value={selectedLga} onValueChange={setSelectedLga}>
              <SelectTrigger className="min-w-[180px]">
                <SelectValue placeholder="All LGAs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All LGAs</SelectItem>
                {lgas.map((lga) => (
                  <SelectItem key={lga} value={lga}>
                    {lga}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedErrorType} onValueChange={setSelectedErrorType}>
              <SelectTrigger className="min-w-[180px]">
                <SelectValue placeholder="All Error Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Error Types</SelectItem>
                {errorTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatErrorLabel(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedInterviewer} onValueChange={setSelectedInterviewer}>
              <SelectTrigger className="min-w-[200px]">
                <SelectValue placeholder="All Interviewers (A1 only)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Interviewers</SelectItem>
                {interviewers.map((interviewer) => (
                  <SelectItem key={interviewer.id} value={interviewer.id}>
                    <span className="font-medium">{interviewer.id}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative h-[500px] w-full overflow-hidden rounded-lg border">
            <div ref={mapContainerRef} className="sticky top-20 z-0 h-full w-full" style={{ zIndex: 0 }} />
          </div>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {(
                colorMode === "path"
                  ? [
                      { label: "Treatment path (B2 = Yes)", color: "#2563eb" },
                      { label: "Control path (B2 = No)", color: "#22c55e" },
                    ]
                  : [
                      { label: "Approved", color: "#16a34a" },
                      { label: "Not Approved", color: "#dc2626" },
                    ]
              ).map((item) => (
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
              <div className="flex flex-1 justify-start">
                <span>Showing {filteredSubmissions.length.toLocaleString()} submissions</span>
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
                  className="rounded-md border p-1"
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
                <Button onClick={handleExportMap} disabled={isExporting} size="sm" className="w-full md:w-auto">
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
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
