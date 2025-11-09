import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Tag, Download } from "lucide-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for default marker icons in react-leaflet
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

function LGALabels({ show, submissions }: { show: boolean; submissions: Submission[] }) {
  if (!show) return null;

  // Group submissions by LGA and calculate center points
  const lgaCenters = submissions.reduce((acc, sub) => {
    if (!acc[sub.lga]) {
      acc[sub.lga] = { lat: 0, lng: 0, count: 0, state: sub.state };
    }
    acc[sub.lga].lat += sub.lat;
    acc[sub.lga].lng += sub.lng;
    acc[sub.lga].count += 1;
    return acc;
  }, {} as Record<string, { lat: number; lng: number; count: number; state: string }>);

  return (
    <>
      {Object.entries(lgaCenters).map(([lga, data]) => {
        const avgLat = data.lat / data.count;
        const avgLng = data.lng / data.count;
        
        const icon = L.divIcon({
          className: "lga-label",
          html: `<div style="background: rgba(37, 99, 235, 0.9); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${lga}</div>`,
          iconSize: [0, 0] as L.PointTuple,
        });

        return (
          <Marker key={lga} position={[avgLat, avgLng]} {...({ icon } as any)} />
        );
      })}
    </>
  );
}

export function InteractiveMap({ submissions }: InteractiveMapProps) {
  const [showLabels, setShowLabels] = useState(false);

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
      iconSize: [12, 12] as L.PointTuple,
      iconAnchor: [6, 6] as L.PointTuple,
    });
  };

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
          <MapContainer
            {...({
              center: [9.082, 8.6753],
              zoom: 6,
              style: { height: "100%", width: "100%" },
              scrollWheelZoom: true,
            } as any)}
          >
            <TileLayer
              {...({
                url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
              } as any)}
            />
            
            <LGALabels show={showLabels} submissions={submissions} />
            
            {submissions.map((submission) => (
              <Marker
                key={submission.id}
                position={[submission.lat, submission.lng]}
                {...({ icon: createCustomIcon(submission.status) } as any)}
              >
                <Popup>
                  <div className="min-w-[200px] space-y-2">
                    <div className="font-bold text-primary">Submission #{submission.id}</div>
                    <div className="space-y-1 text-sm">
                      <div>
                        <span className="font-medium">Interviewer:</span> {submission.interviewer}
                      </div>
                      <div>
                        <span className="font-medium">LGA:</span> {submission.lga}
                      </div>
                      <div>
                        <span className="font-medium">State:</span> {submission.state}
                      </div>
                      <div>
                        <span className="font-medium">Status:</span>{" "}
                        <span
                          className={`font-semibold ${
                            submission.status === "valid"
                              ? "text-success"
                              : submission.status === "invalid"
                              ? "text-destructive"
                              : "text-warning"
                          }`}
                        >
                          {submission.status.toUpperCase()}
                        </span>
                      </div>
                      {submission.errorTypes.length > 0 && (
                        <div>
                          <span className="font-medium">Errors:</span>{" "}
                          {submission.errorTypes.join(", ")}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {submission.timestamp}
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
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
