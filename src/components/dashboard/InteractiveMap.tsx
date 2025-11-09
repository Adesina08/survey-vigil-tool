import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Tag, Download } from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default marker icons when bundling Leaflet
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
  status: "valid" | "invalid" | "terminated";
}

interface InteractiveMapProps {
  submissions: Submission[];
}

export function InteractiveMap({ submissions }: InteractiveMapProps) {
  const [showLabels, setShowLabels] = useState(false);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const labelLayerRef = useRef<L.LayerGroup | null>(null);

  const handleExportMap = () => {
    console.log("Exporting map...");
    // Implementation for map export
  };

  const getMarkerColor = (status: string) => {
    switch (status) {
      case "valid":
        return "#16a34a"; // success
      case "invalid":
        return "#dc2626"; // destructive
      case "terminated":
        return "#ea580c"; // warning
      default:
        return "#2563eb"; // primary
    }
  };

  const createCustomIcon = (status: string) => {
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
        ? `<div><span style="font-weight: 600;">Errors:</span> ${submission.errorTypes.join(", ")}</div>`
        : "";

    return `
      <div style="min-width:200px;display:flex;flex-direction:column;gap:8px;font-size:14px;font-family:Inter,system-ui,sans-serif;">
        <div style="font-weight:700;color:#2563eb;">Submission #${submission.id}</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div><span style="font-weight:600;">Interviewer:</span> ${submission.interviewer}</div>
          <div><span style="font-weight:600;">LGA:</span> ${submission.lga}</div>
          <div><span style="font-weight:600;">State:</span> ${submission.state}</div>
          <div><span style="font-weight:600;">Status:</span> <span style="font-weight:700;color:${statusColor};">${submission.status.toUpperCase()}</span></div>
          ${errorsSection}
          <div style="font-size:12px;color:#64748b;">${submission.timestamp}</div>
        </div>
      </div>
    `;
  };

  useEffect(() => {
    if (!mapRef.current && mapContainerRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        center: [9.082, 8.6753],
        zoom: 6,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(mapRef.current);
    }

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      markerLayerRef.current = null;
      labelLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!markerLayerRef.current) {
      markerLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const layer = markerLayerRef.current;
    layer.clearLayers();

    submissions.forEach((submission) => {
      const marker = L.marker([submission.lat, submission.lng], {
        icon: createCustomIcon(submission.status),
      });

      marker.bindPopup(createPopupContent(submission));
      marker.addTo(layer);
    });
  }, [submissions]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (!labelLayerRef.current) {
      labelLayerRef.current = L.layerGroup().addTo(mapRef.current);
    }

    const layer = labelLayerRef.current;
    layer.clearLayers();

    if (!showLabels) {
      return;
    }

    const lgaCenters = submissions.reduce(
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

      const icon = L.divIcon({
        className: "lga-label",
        html: `<div style="background: rgba(37, 99, 235, 0.9); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${lga}</div>`,
        iconSize: [0, 0],
      });

      L.marker([avgLat, avgLng], { icon }).addTo(layer);
    });
  }, [showLabels, submissions]);

  return (
    <Card className="fade-in">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Survey Locations
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLabels(!showLabels)}
            className="gap-2"
          >
            <Tag className="h-4 w-4" />
            {showLabels ? "Hide" : "Show"} LGA Labels
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportMap} className="gap-2">
            <Download className="h-4 w-4" />
            Export Map
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[500px] w-full overflow-hidden rounded-lg border">
          <div ref={mapContainerRef} className="h-full w-full" />
        </div>

        <div className="mt-4 flex items-center justify-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-success" />
            <span>Valid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-destructive" />
            <span>Invalid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-warning" />
            <span>Terminated</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
