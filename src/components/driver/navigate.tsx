import { useTranslations } from "next-intl";
import { Navigation } from "lucide-react";

/** Deep links into Google Maps and Waze (both open the native apps when installed). */
export function NavigateButtons({ lat, lng, address }: { lat: number | null; lng: number | null; address: string }) {
  const t = useTranslations("driver.job");
  const hasCoords = lat !== null && lng !== null;
  if (!hasCoords && !address) return null;
  const dest = hasCoords ? `${lat},${lng}` : address;
  const google = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=driving`;
  const waze = hasCoords
    ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    : `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
  return (
    <>
      <a
        href={google}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-500 font-semibold text-white shadow-sm shadow-brand-500/30 active:bg-brand-600"
      >
        <Navigation className="h-5 w-5" /> {t("googleMaps")}
      </a>
      <a
        href={waze}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-sky-500 font-semibold text-white active:bg-sky-600"
      >
        <Navigation className="h-5 w-5" /> Waze
      </a>
    </>
  );
}
