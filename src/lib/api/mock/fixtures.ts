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
  /** Video consultation feature. */
  offersVideo: boolean;
  /** Insurance feature: ids of accepted providers. */
  insuranceIds: string[];
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
    offersVideo: false,
    insuranceIds: ["f1000000-0000-4000-8000-000000000001", "f1000000-0000-4000-8000-000000000002"],
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
    offersVideo: true,
    insuranceIds: ["f1000000-0000-4000-8000-000000000002"],
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
    offersVideo: true,
    insuranceIds: ["f1000000-0000-4000-8000-000000000001", "f1000000-0000-4000-8000-000000000003"],
  },
];

export const insuranceProviders: { id: string; name: Bilingual }[] = [
  { id: "f1000000-0000-4000-8000-000000000001", name: { ar: "مصر كير للتأمين الصحي", en: "Misr Care Health Insurance" } },
  { id: "f1000000-0000-4000-8000-000000000002", name: { ar: "النيل للتأمين الطبي", en: "Nile Medical Insurance" } },
  { id: "f1000000-0000-4000-8000-000000000003", name: { ar: "دلتا هيلث", en: "Delta Health" } },
];

export type MockCoupon = {
  id: string;
  code: string;
  title: Bilingual;
  description: Bilingual;
  discountType: "Percent" | "Fixed";
  value: number;
  maxDiscountEgp?: number;
  /** Days from today (negative = already started / expired). */
  validFromDays: number;
  validToDays: number;
  maxRedemptions?: number;
  redemptions: number;
  perPatientLimit: number;
  doctorId?: string;
  serviceId?: string;
  isPublic: boolean;
};

export const coupons: MockCoupon[] = [
  {
    id: "91000000-0000-4000-8000-000000000001",
    code: "WELCOME20",
    title: { ar: "خصم ٢٠٪ على أول زيارة", en: "20% off your first visit" },
    description: {
      ar: "للمرضى الجدد على جميع الخدمات، بحد أقصى ١٥٠ ج.م.",
      en: "For new patients on every service, up to 150 EGP.",
    },
    discountType: "Percent",
    value: 20,
    maxDiscountEgp: 150,
    validFromDays: -30,
    validToDays: 60,
    redemptions: 41,
    perPatientLimit: 1,
    isPublic: true,
  },
  {
    id: "91000000-0000-4000-8000-000000000002",
    code: "SMILE100",
    title: { ar: "١٠٠ ج.م. خصم على تنظيف الأسنان", en: "100 EGP off teeth cleaning" },
    description: {
      ar: "عرض الشتاء: خصم ثابت على جلسة تنظيف الأسنان مع د. سارة حسن.",
      en: "Winter offer: a flat discount on a cleaning session with Dr. Sara Hassan.",
    },
    discountType: "Fixed",
    value: 100,
    validFromDays: -10,
    validToDays: 45,
    redemptions: 12,
    perPatientLimit: 2,
    doctorId: "d1000000-0000-4000-8000-000000000001",
    serviceId: "e1000000-0000-4000-8000-000000000002",
    isPublic: true,
  },
  {
    id: "91000000-0000-4000-8000-000000000003",
    code: "KIDS15",
    title: { ar: "خصم ١٥٪ على كشف الأطفال", en: "15% off child check-ups" },
    description: {
      ar: "لأطفالك: خصم على كشف الأطفال والفلورايد مع د. منى عادل.",
      en: "For your little ones: a discount on child check-ups and fluoride with Dr. Mona Adel.",
    },
    discountType: "Percent",
    value: 15,
    validFromDays: -5,
    validToDays: 30,
    redemptions: 7,
    perPatientLimit: 3,
    doctorId: "d1000000-0000-4000-8000-000000000003",
    isPublic: true,
  },
  {
    id: "91000000-0000-4000-8000-000000000004",
    code: "OLDDEAL",
    title: { ar: "عرض منتهي", en: "Expired deal" },
    description: { ar: "عرض منتهي.", en: "An expired deal." },
    discountType: "Percent",
    value: 10,
    validFromDays: -90,
    validToDays: -10,
    redemptions: 100,
    perPatientLimit: 1,
    isPublic: false,
  },
];

export type MockReview = {
  doctorId: string;
  rating: number;
  comment: Bilingual;
  name: Bilingual;
  daysAgo: number;
  reply?: Bilingual;
};

export const reviews: MockReview[] = [
  {
    doctorId: "d1000000-0000-4000-8000-000000000001",
    rating: 5,
    comment: { ar: "دكتورة محترمة جدًا والتنظيف كان بدون أي ألم. العيادة نظيفة والمواعيد منضبطة.", en: "Very professional, and the cleaning was completely painless. A clean clinic and on-time appointments." },
    name: { ar: "محمد", en: "Mohamed" },
    daysAgo: 6,
    reply: { ar: "شكرًا لثقتك يا أستاذ محمد، في انتظارك في الزيارة القادمة.", en: "Thank you for your trust, Mohamed. See you at your next visit." },
  },
  {
    doctorId: "d1000000-0000-4000-8000-000000000001",
    rating: 5,
    comment: { ar: "شرحت لي كل خطوة قبل الحشو وكانت النتيجة ممتازة.", en: "Explained every step before the filling and the result is excellent." },
    name: { ar: "نورهان", en: "Nourhan" },
    daysAgo: 15,
  },
  {
    doctorId: "d1000000-0000-4000-8000-000000000001",
    rating: 4,
    comment: { ar: "تجربة جيدة جدًا، لكن انتظرت عشر دقائق قبل الدخول.", en: "A very good experience, though I waited ten minutes before going in." },
    name: { ar: "كريم", en: "Karim" },
    daysAgo: 27,
  },
  {
    doctorId: "d1000000-0000-4000-8000-000000000001",
    rating: 5,
    comment: { ar: "أفضل كشف أسنان عملته. أنصح بها بشدة.", en: "The best dental check-up I have had. Highly recommended." },
    name: { ar: "هبة", en: "Heba" },
    daysAgo: 41,
  },
  {
    doctorId: "d1000000-0000-4000-8000-000000000001",
    rating: 4,
    comment: { ar: "تعامل راقٍ وسعر مناسب.", en: "Courteous and fairly priced." },
    name: { ar: "يوسف", en: "Youssef" },
    daysAgo: 58,
  },
  {
    doctorId: "d1000000-0000-4000-8000-000000000001",
    rating: 5,
    comment: { ar: "ممتازة.", en: "Excellent." },
    name: { ar: "سلمى", en: "Salma" },
    daysAgo: 70,
  },
  {
    doctorId: "d1000000-0000-4000-8000-000000000002",
    rating: 5,
    comment: { ar: "خطة التقويم كانت واضحة من أول جلسة والمتابعة الشهرية منتظمة.", en: "The braces plan was clear from the first session and the monthly follow-ups are regular." },
    name: { ar: "ياسمين", en: "Yasmine" },
    daysAgo: 9,
  },
  {
    doctorId: "d1000000-0000-4000-8000-000000000002",
    rating: 4,
    comment: { ar: "الاستشارة عبر الفيديو وفّرت علي وقت كبير.", en: "The video consultation saved me a lot of time." },
    name: { ar: "عمرو", en: "Amr" },
    daysAgo: 22,
  },
  {
    doctorId: "d1000000-0000-4000-8000-000000000003",
    rating: 5,
    comment: { ar: "ابنتي كانت خايفة جدًا وطلعت من العيادة مبسوطة. شكرًا يا دكتورة!", en: "My daughter was very scared and left the clinic smiling. Thank you, doctor!" },
    name: { ar: "أحمد", en: "Ahmed" },
    daysAgo: 4,
    reply: { ar: "ربنا يخليها لكم، كانت بطلة النهاردة.", en: "She was a little hero today. Wishing her the best." },
  },
  {
    doctorId: "d1000000-0000-4000-8000-000000000003",
    rating: 5,
    comment: { ar: "صبورة جدًا مع الأطفال.", en: "Very patient with children." },
    name: { ar: "دينا", en: "Dina" },
    daysAgo: 18,
  },
];

export const MOCK_MEMBER_PREFIX = "a2";

/** A fixed demo clinic closure (relative to today) plus real Egyptian public holidays. */
export const holidays: { date: string; name: Bilingual }[] = [
  { date: "2026-10-06", name: { ar: "عيد القوات المسلحة", en: "Armed Forces Day" } },
  { date: "2027-01-07", name: { ar: "عيد الميلاد المجيد", en: "Coptic Christmas" } },
  { date: "2027-01-25", name: { ar: "عيد الثورة والشرطة", en: "Revolution Day" } },
  { date: "2027-04-25", name: { ar: "عيد تحرير سيناء", en: "Sinai Liberation Day" } },
  { date: "2027-05-01", name: { ar: "عيد العمال", en: "Labour Day" } },
];

/** Days from today of the demo closure shown in the slot picker. */
export const DEMO_CLOSURE_DAYS = 5;
export const DEMO_CLOSURE_NAME: Bilingual = {
  ar: "إجازة المركز: الجرد السنوي",
  en: "Clinic closed: annual inventory",
};

export const patient = {
  id: "b1000000-0000-4000-8000-000000000001",
  phone: "+201012345678",
  fullName: "أحمد مصطفى",
  role: "Patient" as const,
  preferredLanguage: "ar" as const,
};

export const MOCK_OTP = "123456";

export const records = {
  medicalInfo: {
    bloodType: "O+",
    allergies: { ar: "حساسية من البنسلين", en: "Allergic to penicillin" },
    chronicConditions: { ar: "لا يوجد", en: "None" },
    medications: { ar: "فيتامين د ١٠٠٠ وحدة يوميًا", en: "Vitamin D 1000 IU daily" },
  },
  entries: [
    {
      id: "71000000-0000-4000-8000-000000000001",
      kind: "Diagnosis" as const,
      title: { ar: "التهاب لثة بسيط", en: "Mild gingivitis" },
      body: {
        ar: "التهاب بسيط في اللثة الأمامية السفلية. يُنصح بالتنظيف كل ستة أشهر واستخدام خيط الأسنان يوميًا.",
        en: "Mild inflammation of the lower front gums. Cleaning every six months and daily flossing are advised.",
      },
      doctorIndex: 0,
      daysAgo: 20,
    },
    {
      id: "71000000-0000-4000-8000-000000000002",
      kind: "Prescription" as const,
      title: { ar: "غسول فم بالكلورهيكسيدين", en: "Chlorhexidine mouthwash" },
      body: {
        ar: "٢٠ مل مرتين يوميًا بعد الفرش لمدة ١٠ أيام.",
        en: "20 ml twice a day after brushing for 10 days.",
      },
      doctorIndex: 0,
      daysAgo: 20,
    },
    {
      id: "71000000-0000-4000-8000-000000000003",
      kind: "Note" as const,
      title: { ar: "ملاحظات بعد التنظيف", en: "Notes after cleaning" },
      body: {
        ar: "تجنب المشروبات الملونة لمدة ٢٤ ساعة. موعد المتابعة بعد ستة أشهر.",
        en: "Avoid coloured drinks for 24 hours. Next check-up in six months.",
      },
      doctorIndex: 0,
      daysAgo: 20,
    },
  ],
};
