// Demo fixtures for MOCK_API=1: one Cairo clinic, three doctors, the seeded
// specialties and a logged-in patient. All names are fictional.

export const MOCK_TIMEZONE = "Africa/Cairo";

type Bilingual = { ar: string; en: string };

export const specialties: { id: string; name: Bilingual }[] = [
  { id: "a1000000-0000-4000-8000-000000000001", name: { ar: "طب الأسنان العام", en: "General Dentistry" } },
  { id: "a1000000-0000-4000-8000-000000000002", name: { ar: "تقويم الأسنان", en: "Orthodontics" } },
  { id: "a1000000-0000-4000-8000-000000000003", name: { ar: "أسنان الأطفال", en: "Pediatric Dentistry" } },
  { id: "a1000000-0000-4000-8000-000000000004", name: { ar: "علاج الجذور", en: "Endodontics" } },
  { id: "a1000000-0000-4000-8000-000000000005", name: { ar: "تجميل الأسنان", en: "Cosmetic Dentistry" } },
  { id: "a1000000-0000-4000-8000-000000000006", name: { ar: "جراحة الفم", en: "Oral Surgery" } },
];

export const clinic = {
  id: "c1000000-0000-4000-8000-000000000001",
  name: { ar: "مركز مون لايت لطب الأسنان", en: "Moonlight Dental Center" },
  address: {
    ar: "١٢ شارع ٩، المعادي، القاهرة",
    en: "12 Road 9, Maadi, Cairo",
  },
  city: { ar: "القاهرة", en: "Cairo" },
  phone: "+20225550100",
  latitude: 29.9602,
  longitude: 31.2569,
  timezone: MOCK_TIMEZONE,
};

export type MockService = {
  id: string;
  name: Bilingual;
  durationMinutes: number;
  priceEgp: number | null;
};

export type MockDoctor = {
  id: string;
  slug: string;
  name: Bilingual;
  bio: Bilingual;
  specialtyId: string;
  yearsExperience: number;
  consultationFeeEgp: number;
  services: MockService[];
  /** Local wall-clock windows offered every day except `closedWeekday`. */
  windows: { from: string; to: string }[];
  closedWeekday: number | null;
};

export const doctors: MockDoctor[] = [
  {
    id: "d1000000-0000-4000-8000-000000000001",
    slug: "sara-hassan",
    name: { ar: "د. سارة حسن", en: "Dr. Sara Hassan" },
    bio: {
      ar: "طبيبة أسنان عامة بخبرة تتجاوز اثني عشر عامًا في الفحص الدوري وتنظيف الأسنان والحشوات التجميلية، وتهتم بتجربة علاج هادئة ومريحة لكل مريض.",
      en: "General dentist with more than twelve years of experience in check-ups, cleaning and cosmetic fillings, focused on a calm and comfortable visit for every patient.",
    },
    specialtyId: specialties[0].id,
    yearsExperience: 12,
    consultationFeeEgp: 300,
    services: [
      { id: "e1000000-0000-4000-8000-000000000001", name: { ar: "كشف وفحص", en: "Check-up" }, durationMinutes: 30, priceEgp: 300 },
      { id: "e1000000-0000-4000-8000-000000000002", name: { ar: "تنظيف الأسنان", en: "Teeth cleaning" }, durationMinutes: 30, priceEgp: 450 },
      { id: "e1000000-0000-4000-8000-000000000003", name: { ar: "حشو تجميلي", en: "Composite filling" }, durationMinutes: 60, priceEgp: 700 },
    ],
    windows: [
      { from: "09:00", to: "13:00" },
      { from: "16:00", to: "20:00" },
    ],
    closedWeekday: 5,
  },
  {
    id: "d1000000-0000-4000-8000-000000000002",
    slug: "omar-farouk",
    name: { ar: "د. عمر فاروق", en: "Dr. Omar Farouk" },
    bio: {
      ar: "أخصائي تقويم الأسنان للأطفال والبالغين، يقدّم خطط علاج واضحة مع تقويم معدني وشفاف ومتابعة شهرية منتظمة.",
      en: "Orthodontist for children and adults, offering clear treatment plans with metal and clear braces and regular monthly follow-ups.",
    },
    specialtyId: specialties[1].id,
    yearsExperience: 9,
    consultationFeeEgp: 400,
    services: [
      { id: "e1000000-0000-4000-8000-000000000004", name: { ar: "استشارة تقويم", en: "Braces consultation" }, durationMinutes: 30, priceEgp: 400 },
      { id: "e1000000-0000-4000-8000-000000000005", name: { ar: "متابعة تقويم", en: "Braces follow-up" }, durationMinutes: 30, priceEgp: 350 },
    ],
    windows: [{ from: "12:00", to: "20:00" }],
    closedWeekday: 5,
  },
  {
    id: "d1000000-0000-4000-8000-000000000003",
    slug: "mona-adel",
    name: { ar: "د. منى عادل", en: "Dr. Mona Adel" },
    bio: {
      ar: "طبيبة أسنان أطفال تحرص على تحويل الزيارة إلى تجربة ممتعة، مع خبرة في الوقاية والفلورايد وعلاج تسوس الأسنان اللبنية.",
      en: "Pediatric dentist who turns the visit into a friendly experience, experienced in prevention, fluoride and treating decay in baby teeth.",
    },
    specialtyId: specialties[2].id,
    yearsExperience: 7,
    consultationFeeEgp: 350,
    services: [
      { id: "e1000000-0000-4000-8000-000000000006", name: { ar: "كشف أطفال", en: "Child check-up" }, durationMinutes: 30, priceEgp: 350 },
      { id: "e1000000-0000-4000-8000-000000000007", name: { ar: "فلورايد وقائي", en: "Fluoride treatment" }, durationMinutes: 15, priceEgp: 250 },
    ],
    windows: [{ from: "10:00", to: "15:00" }],
    closedWeekday: null,
  },
];

export const patient = {
  id: "b1000000-0000-4000-8000-000000000001",
  phone: "+201012345678",
  fullName: "أحمد مصطفى",
  role: "Patient" as const,
  preferredLanguage: "ar" as const,
};

export const MOCK_OTP = "123456";
