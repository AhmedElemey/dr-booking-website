// The API stores `city` as plain text (English, not localized) and filters on that exact
// value, so the filter value stays as the API returns it and only the label is translated.
const AR_CITY_NAMES: Record<string, string> = {
  cairo: "القاهرة",
  giza: "الجيزة",
  alexandria: "الإسكندرية",
  "new cairo": "القاهرة الجديدة",
  "6th of october": "٦ أكتوبر",
  mansoura: "المنصورة",
  tanta: "طنطا",
};

export function cityLabel(city: string, locale: string): string {
  return locale === "ar" ? (AR_CITY_NAMES[city.trim().toLowerCase()] ?? city) : city;
}
