import { cityLabel } from "@/lib/cities";

import { inputClass, labelClass } from "./ui";

/** City filter select. Renders nothing for single-branch clinics (multiBranch off). */
export function CityField({
  enabled,
  id,
  cities,
  value,
  locale,
  label,
  allLabel,
  className,
}: {
  enabled: boolean;
  id: string;
  cities: string[];
  value?: string;
  locale: string;
  label: string;
  allLabel: string;
  className?: string;
}) {
  if (!enabled) return null;
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <select id={id} name="city" className={inputClass} defaultValue={value ?? ""}>
        <option value="">{allLabel}</option>
        {cities.map((city) => (
          <option key={city} value={city}>
            {cityLabel(city, locale)}
          </option>
        ))}
      </select>
    </div>
  );
}
