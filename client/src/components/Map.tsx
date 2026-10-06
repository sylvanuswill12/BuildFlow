/// <reference types="@types/google.maps" />
import { useEffect, useRef } from "react";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

declare global {
  interface Window { google?: typeof google }
}

const mapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
let mapsLoadPromise: Promise<void> | undefined;

function loadMapScript() {
  if (window.google?.maps) return Promise.resolve();
  if (!mapsApiKey) return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not configured."));
  if (mapsLoadPromise) return mapsLoadPromise;
  mapsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsApiKey)}&v=weekly&libraries=marker,places,geometry`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossible de charger Google Maps."));
    document.head.appendChild(script);
  });
  return mapsLoadPromise;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({ className, initialCenter = { lat: 37.7749, lng: -122.4194 }, initialZoom = 12, onMapReady }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const init = usePersistFn(async () => {
    await loadMapScript();
    if (!mapContainer.current || !window.google) return;
    const map = new window.google.maps.Map(mapContainer.current, {
      zoom: initialZoom,
      center: initialCenter,
      mapTypeControl: true,
      fullscreenControl: true,
      zoomControl: true,
      streetViewControl: true,
    });
    onMapReady?.(map);
  });
  useEffect(() => { void init(); }, [init]);
  return <div ref={mapContainer} className={cn("h-[500px] w-full", className)} />;
}
