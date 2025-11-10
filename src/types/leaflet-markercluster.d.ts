import "leaflet";

declare module "leaflet" {
  interface MarkerClusterGroupOptions extends L.LayerOptions {
    chunkedLoading?: boolean;
    chunkDelay?: number;
    chunkInterval?: number;
    disableClusteringAtZoom?: number;
    maxClusterRadius?: number | ((zoom: number) => number);
    showCoverageOnHover?: boolean;
    spiderfyOnMaxZoom?: boolean;
  }

  interface MarkerClusterGroup extends L.FeatureGroup<L.Marker> {
    addLayers(layers: L.Layer[]): this;
    clearLayers(): this;
  }

  function markerClusterGroup(options?: MarkerClusterGroupOptions): MarkerClusterGroup;
}

declare module "leaflet.markercluster" {
  const value: undefined;
  export default value;
}
