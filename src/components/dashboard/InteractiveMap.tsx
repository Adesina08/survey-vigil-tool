import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Download } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import L from "leaflet";
import "leaflet.markercluster";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { formatErrorLabel } from "@/lib/utils";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Submission {
  id: string;
  lat: number;
  lng: number;
  interviewer: string;
  lga: string;
  state: string;
  errorTypes: string[];
  timestamp: string;
  status: "approved" | "not_approved";
}

interface InteractiveMapProps {
  submissions: Submission[];
  interviewers: string[];
  errorTypes: string[];
}

type Html2CanvasFn = (element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLCanvasElement>;

const getMarkerColor = (status: Submission["status"]) => {
  switch (status) {
    case "approved":
      return "#16a34a";
    case "not_approved":
    default:
      return "#dc2626";
  }
};

const createCustomIcon = (status: Submission["status"]) => {
  const color = getMarkerColor(status);
  return L.divIcon({
    className: "custom-marker",
    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
};

const createPopupContent = (submission: Submission) => {
  const statusColor = getMarkerColor(submission.status);
  const errorsSection =
    submission.errorTypes.length > 0
      ? `<div><span style="font-weight: 600;">Errors:</span> ${submission.errorTypes
          .map((value) => formatErrorLabel(value))
          .join(", ")}</div>`
      : "<div><span style=\"font-weight: 600;\">Errors:</span> None</div>";

  const statusLabel = submission.status === "approved" ? "APPROVED" : "NOT APPROVED";

  return `
      <div style="min-width:220px;display:flex;flex-direction:column;gap:8px;font-size:14px;font-family:Inter,system-ui,sans-serif;">
        <div style="font-weight:700;color:#2563eb;">Submission #${submission.id}</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div><span style="font-weight:600;">Interviewer:</span> ${submission.interviewer}</div>
          <div><span style="font-weight:600;">LGA:</span> ${submission.lga}</div>
          <div><span style="font-weight:600;">Status:</span> <span style="font-weight:700;color:${statusColor};">${statusLabel}</span></div>
          ${errorsSection}
          <div style="font-size:12px;color:#64748b;">${submission.timestamp}</div>
        </div>
      </div>
    `;
};

const loadHtml2Canvas = async (): Promise<Html2CanvasFn> => {
  if (typeof window === "undefined") {
    throw new Error("html2canvas can only be used in the browser");
  }

  if ((window as any).html2canvas) {
    return (window as any).html2canvas as Html2CanvasFn;
  }

  const existingScript = document.querySelector<HTMLScriptElement>("script[data-html2canvas]");
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener(
        "load",
        () => resolve((window as any).html2canvas as Html2CanvasFn),
        { once: true }
      );
      existingScript.addEventListener("error", reject, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    script.async = true;
    script.dataset.html2canvas = "true";
    script.onload = () => resolve((window as any).html2canvas as Html2CanvasFn);
    script.onerror = (event) => reject(event);
    document.body.appendChild(script);
  });
};

export function InteractiveMap({ submissions, interviewers, errorTypes }: InteractiveMapProps) {
  const [selectedErrorType, setSelectedErrorType] = useState("all");
  const [selectedInterviewer, setSelectedInterviewer] = useState("all");
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markerClusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const labelLayerRef = useRef<L.LayerGroup | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const [geoJsonFeatures, setGeoJsonFeatures] = useState<
    Feature<Geometry, Record<string, unknown>>[]
  >([]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((submission) => {
      const matchesError =
        selectedErrorType === "all" || submission.errorTypes.includes(selectedErrorType);
      const matchesInterviewer =
        selectedInterviewer === "all" || submission.interviewer === selectedInterviewer;
      return matchesError && matchesInterviewer;
    });
  }, [submissions, selectedErrorType, selectedInterviewer]);

  const handleExportMap = async () => {
    if (!mapContainerRef.current) return;

    try {
      const html2canvas = await loadHtml2Canvas();
      const canvas = await html2canvas(mapContainerRef.current, {
        useCORS: true,
        scale: window.devicePixelRatio || 1,
      });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `ogun-survey-map-${Date.now()}.png`;
      link.click();
    } catch (error) {
      console.error("Failed to export map", error);
    }
  };

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
      }).addTo(mapRef.current);

      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 300);
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerClusterRef.current?.remove();
      markerClusterRef.current = null;
      labelLayerRef.current = null;
      boundaryLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    const loadBoundary = async () => {
      try {
        const response = await fetch("/ogun-lga.geojson");
        if (!response.ok) return;
        const geoJson = (await response.json()) as FeatureCollection<Geometry, Record<string, unknown>>;

        boundaryLayerRef.current?.remove();
        boundaryLayerRef.current = L.geoJSON(geoJson, {
          style: () => ({
            color: "#1d4ed8",
            weight: 1.5,
            fillOpacity: 0.12,
            fillColor: "#93c5fd",
          }),
        }).addTo(mapRef.current!);

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

    if (!markerClusterRef.current) {
      markerClusterRef.current = L.markerClusterGroup({
        chunkedLoading: true,
        chunkDelay: 50,
        chunkInterval: 100,
        disableClusteringAtZoom: 13,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
      });

      markerClusterRef.current.addTo(mapRef.current);
    }

    const layer = markerClusterRef.current;
    layer.clearLayers();

    const markers = filteredSubmissions.map((submission) => {
      const marker = L.marker([submission.lat, submission.lng], {
        icon: createCustomIcon(submission.status),
      });

      marker.bindPopup(createPopupContent(submission));
      return marker;
    });

    layer.addLayers(markers);
  }, [filteredSubmissions]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!labelLayerRef.current) {
      labelLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const layer = labelLayerRef.current;
    layer.clearLayers();

    const addLabel = (name: string, center: L.LatLngExpression) => {
      const icon = L.divIcon({
        className: "lga-label",
        html: `<div style="background: rgba(37, 99, 235, 0.92); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(15, 23, 42, 0.25);">${name}</div>`,
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
  }, [filteredSubmissions, geoJsonFeatures]);

  useEffect(() => {
    if (!mapRef.current) return;
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 200);
  }, [filteredSubmissions.length]);

  return (
    <Card className="fade-in">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 self-start">
          <MapPin className="h-5 w-5 text-primary" />
          <CardTitle className="text-left">Submissions on Map</CardTitle>
        </div>
        <div className="flex items-center gap-3 overflow-x-auto pb-1">
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
              <SelectValue placeholder="All Interviewers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Interviewers</SelectItem>
              {interviewers.map((interviewer) => (
                <SelectItem key={interviewer} value={interviewer}>
                  {interviewer}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[500px] w-full overflow-hidden rounded-lg border">
          <div ref={mapContainerRef} className="h-full w-full" />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-muted-foreground">
            Showing {filteredSubmissions.length.toLocaleString()} submissions
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportMap} className="gap-2">
              <Download className="h-4 w-4" />
              Export Map
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
