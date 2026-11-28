"use client";
import * as React from "react";
import { COUNTRIES } from "@/lib/countries";

/**
 * When the company country changes, pre-fill the matching currency, standard VAT rate and
 * distance unit (e.g. Saudi Arabia → SAR, 15 %, km; Qatar → QAR, 0 % because there is no VAT).
 * The user can still change each value before saving.
 */
export function CountryDefaults() {
  const ref = React.useRef<HTMLSpanElement>(null);
  React.useEffect(() => {
    const form = ref.current?.closest("form");
    const select = form?.querySelector<HTMLSelectElement>('select[name="country"]');
    if (!form || !select) return;
    const onChange = () => {
      const c = COUNTRIES.find((x) => x.code === select.value);
      if (!c) return;
      const set = (name: string, value: string) => {
        const el = form.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${name}"]`);
        if (el) {
          el.value = value;
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };
      set("currency", c.currency);
      set("default_vat_rate", String(c.vat));
      if (c.distanceUnit) set("distance_unit", c.distanceUnit);
    };
    select.addEventListener("change", onChange);
    return () => select.removeEventListener("change", onChange);
  }, []);
  return <span ref={ref} hidden />;
}
