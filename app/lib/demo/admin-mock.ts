// Demo-д ашиглах mock өгөгдөл — СӨХ-ийн админ нүднээс.
// Утасны демо (/demo-admin) болон desktop демо (/demo-pc) хоёул ашиглана.

export const sokh = {
  name: 'Нарантуул СӨХ',
  address: 'Баянгол дүүрэг, 1-р хороо',
  manager: 'Ц. Цэрэндулам',
  totalResidents: 124,
  totalDebt: 4850000,
  totalPaid: 7800000,
  collectionRate: 72,
  pendingMaintenance: 8,
  pendingComplaints: 3,
};

export const residents = [
  { name: 'Б. Батболд', apt: 'A-101', debt: 150000, phone: '9911-2233' },
  { name: 'Д. Сараа', apt: 'A-203', debt: 0, phone: '9922-3344' },
  { name: 'Г. Ганбаатар', apt: 'B-105', debt: 85000, phone: '9933-4455' },
  { name: 'О. Оюунаа', apt: 'B-301', debt: 200000, phone: '9944-5566' },
  { name: 'Н. Нарантуяа', apt: 'C-402', debt: 0, phone: '9955-6677' },
  { name: 'С. Сүхбаатар', apt: 'A-505', debt: 50000, phone: '9966-7788' },
  { name: 'Э. Энхжаргал', apt: 'C-201', debt: 100000, phone: '9977-8899' },
  { name: 'Т. Тамир', apt: 'B-404', debt: 0, phone: '9988-9900' },
];

export const recentPayments = [
  { name: 'Д. Сараа', apt: 'A-203', amount: 50000, date: '2026.04.08 14:32', method: 'QPay' },
  { name: 'Н. Нарантуяа', apt: 'C-402', amount: 50000, date: '2026.04.08 11:15', method: 'QPay' },
  { name: 'Т. Тамир', apt: 'B-404', amount: 100000, date: '2026.04.07 17:48', method: 'Бэлэн' },
  { name: 'Б. Батболд', apt: 'A-101', amount: 50000, date: '2026.04.05 09:22', method: 'QPay' },
  { name: 'С. Сүхбаатар', apt: 'A-505', amount: 50000, date: '2026.04.04 16:30', method: 'QPay' },
];

export const announcements = [
  { id: 1, type: '🚨', title: 'Цэвэр усны засвар', target: 'Бүгд', date: '04.08', status: 'Илгээгдсэн', views: 89 },
  { id: 2, type: '📅', title: 'Оршин суугчдын хурал', target: 'Бүгд', date: '04.05', status: 'Илгээгдсэн', views: 112 },
  { id: 3, type: 'ℹ️', title: 'Зогсоолын шинэ дүрэм', target: 'Машинтай', date: '04.01', status: 'Илгээгдсэн', views: 64 },
];

export const maintenanceRequests = [
  { id: 1, title: 'Лифт эвдэрсэн (A блок)', resident: 'Б.Батболд (A-101)', status: 'pending', priority: 'high', date: '04.08' },
  { id: 2, title: 'Орцны гэрэл унтарсан B-2', resident: 'Г.Ганбаатар (B-105)', status: 'in_progress', priority: 'medium', date: '04.07' },
  { id: 3, title: 'Дулааны хоолой алдаж байна', resident: 'О.Оюунаа (B-301)', status: 'pending', priority: 'high', date: '04.06' },
  { id: 4, title: 'Цонхны рам шалбарсан', resident: 'Э.Энхжаргал (C-201)', status: 'pending', priority: 'low', date: '04.05' },
];

export const incomeData = [
  { label: 'Сарын хураамж', amount: 6200000, percent: 79 },
  { label: 'Зогсоолын хураамж', amount: 1100000, percent: 14 },
  { label: 'Бусад орлого', amount: 500000, percent: 7 },
];

export const expenseData = [
  { label: 'Цахилгаан (нийтийн)', amount: 1200000, percent: 22 },
  { label: 'Цэвэрлэгээ', amount: 900000, percent: 17 },
  { label: 'Засвар үйлчилгээ', amount: 1500000, percent: 28 },
  { label: 'Харуул хамгаалалт', amount: 1000000, percent: 18 },
  { label: 'Удирдлагын зардал', amount: 800000, percent: 15 },
];

export const parkingVehicles = [
  { id: 1, plate: '0123 УБА', owner: 'Б. Батболд', apt: 'A-101', model: 'Toyota Prius', color: 'Цагаан', spot: 'P7' },
  { id: 2, plate: '4582 УБВ', owner: 'Д. Сараа', apt: 'A-203', model: 'Hyundai Sonata', color: 'Хар', spot: 'P12' },
  { id: 3, plate: '7711 УБА', owner: 'Г. Ганбаатар', apt: 'B-105', model: 'Lexus RX', color: 'Мөнгөлөг', spot: 'P15' },
  { id: 4, plate: '9920 УБМ', owner: 'О. Оюунаа', apt: 'B-301', model: 'Toyota Land Cruiser', color: 'Цагаан', spot: 'P22' },
];

export const guestVehicles = [
  { id: 1, plate: '5566 УБА', host: 'Г.Ганбаатар', apt: 'B-105', entered: '14:20', allowed: 60, overdue: false },
  { id: 2, plate: '3399 УБВ', host: 'Н.Нарантуяа', apt: 'C-402', entered: '11:05', allowed: 120, overdue: true },
];

export const easyBoxStats = {
  totalBoxes: 24,
  occupied: 16,
  free: 8,
  todayArrived: 5,
  todayPickedUp: 4,
  monthTotal: 142,
  avgPickupHours: 14,
  uptime: 99,
};

export const easyBoxRecent = [
  { id: 1, apt: 'A-101', sender: 'Шарга маркет', time: '14:32', state: 'waiting' as const },
  { id: 2, apt: 'B-301', sender: 'BookHub', time: '11:15', state: 'waiting' as const },
  { id: 3, apt: 'C-402', sender: 'Унаа Худалдаа', time: '09:48', state: 'picked' as const },
  { id: 4, apt: 'A-505', sender: 'GoGo Mongolia', time: '08:22', state: 'picked' as const },
];

export type AiBadge = { kind: 'template' | 'ai' | 'real'; label: string };
export type AiAction = {
  id: string;
  emoji: string;
  title: string;
  sub: string;
  channel: string;
  charLimit?: number;
  inputs: { label: string; value: string }[];
  badges: AiBadge[];
  draft: string;
};

export const aiActions: AiAction[] = [
  {
    id: 'reminder',
    emoji: '💌',
    title: 'Өртэй айлуудад сануулга',
    sub: '4 хэлбэр: SMS / Апп / FB / Албан',
    channel: 'SMS',
    charLimit: 160,
    inputs: [
      { label: 'Төлөөгүй нэхэмжлэл (4-р сар)', value: '35' },
      { label: 'Их өртэй айл (200K₮+)', value: '2' },
      { label: 'Утасны мэдээлэл', value: 'residents-аас' },
    ],
    badges: [
      { kind: 'template', label: '📝 Бэлэн загвар' },
      { kind: 'real', label: '🗄️ Бодит өгөгдөл' },
    ],
    draft:
      'Сайн байна уу, Б. Батболд (А-101). 2026 оны 4-р сарын СӨХ-ийн төлбөрийн үлдэгдэл 150,000₮ байна. Боломжтой бол энэ долоо хоногт төлнө үү. Баярлалаа. — Нарантуул СӨХ',
  },
  {
    id: 'report',
    emoji: '📊',
    title: 'Тайланг ойлгомжтой болгох',
    sub: 'Энгийн монгол хэлээр',
    channel: 'Тайлбар',
    inputs: [
      { label: '4-р сарын орлого', value: '7,800,000₮' },
      { label: '4-р сарын зардал', value: '5,400,000₮' },
      { label: 'Цуглуулалт', value: '72%' },
    ],
    badges: [
      { kind: 'ai', label: '🧠 AI бичсэн' },
      { kind: 'real', label: '🗄️ Бодит өгөгдөл' },
    ],
    draft: `4-р сарын тойм — хялбараар

Энэ сард нийт 7,800,000₮ цугласан. Энэ нь айлын 72% нь төлсөн гэсэн үг — өмнөх сартай харьцуулахад 5%-аар нэмэгджээ.

Хамгийн их зардал: засвар үйлчилгээ (1,500,000₮, нийт зардлын 28%). Үүний дийлэнх нь лифт болон дулааны системд зарцуулагдсан.

Үлдэгдэл өр: 4,850,000₮ (35 айл). 2 айл 3 сараас давсан өртэй явсаар байна — энэ нь нийт өрийн 40%-ийг бүрдүүлж байгаа.`,
  },
  {
    id: 'monthly',
    emoji: '🔍',
    title: 'Сарын дүгнэлт гаргах',
    sub: 'Цуглуулалт, эрсдэл, санал',
    channel: 'Дүгнэлт',
    inputs: [
      { label: 'Сүүлийн 6 сарын төлбөр', value: '✓' },
      { label: 'Айлуудын өрийн түүх', value: '✓' },
      { label: 'Засвар/гомдлын лог', value: '✓' },
    ],
    badges: [
      { kind: 'ai', label: '🧠 AI бичсэн' },
      { kind: 'real', label: '🗄️ Бодит өгөгдөл' },
    ],
    draft: `🎯 4-р сарын СӨХ-ийн дүгнэлт

✅ Сайн явц
• Цуглуулалт 72% — өмнөх сараас +5%
• QPay-р төлсөн айл 64% (өмнөх 51%)
• Зардал төсвөөс 8%-аар бага гарсан

⚠️ Анхаарах
• 2 айл (А-101, B-301) 3 сараас давсан өртэй
• Reserve fund-д сар бүр хуваарилалт хийгдэхгүй байна
• Лифтний засвар А блокт давтагдсаар байна

💡 Санал
1. Их өртэй 2 айлтай биечлэн уулзах
2. Reserve fund-д сар бүр 5% хуваарилах журам Зөвлөлд оруулах
3. Лифтний үндсэн засварт төсөв тусгах`,
  },
  {
    id: 'issues',
    emoji: '🚧',
    title: 'Асуудлын анализ',
    sub: 'Давтан гомдол, overdue',
    channel: 'Анализ',
    inputs: [
      { label: 'Засварын хүсэлт', value: '8' },
      { label: 'Гомдол', value: '3' },
      { label: 'Сүүлийн 30 хоног', value: '✓' },
    ],
    badges: [
      { kind: 'ai', label: '🧠 AI бичсэн' },
      { kind: 'real', label: '🗄️ Бодит өгөгдөл' },
    ],
    draft: `🔍 Асуудлын анализ (4-р сар)

📈 Давтан асуудал
1. Лифт эвдрэл (А блок) — 3 удаа давтагдсан
   Шалтгаан: 8 жилийн настай тоног төхөөрөмж
   Санал: захын засвар биш, үндсэн засвар

2. Дулааны хоолойн алдаа (B-301, B-205) — 2 удаа
   Шалтгаан: хонгилын тусгаарлагч өтөл
   Санал: зуны цагт нийтлэг засвар төлөвлөх

📊 Бүсчлэлээр
• А блок: 4 хүсэлт (50%) — голдуу лифт
• B блок: 3 хүсэлт — голдуу дулаан/ус
• C блок: 1 хүсэлт

⏱️ Хүлээлтийн дундаж: 4.2 өдөр (өмнөх сараас -1.5 өдөр)`,
  },
  {
    id: 'council',
    emoji: '📑',
    title: 'Зөвлөлд 1 нүүр тайлан',
    sub: 'Албан ёсны хэлбэр',
    channel: 'Албан бичиг',
    inputs: [
      { label: 'Санхүүгийн нэгтгэл', value: '✓' },
      { label: 'Өрийн жагсаалт', value: '✓' },
      { label: 'Үйл ажиллагааны лог', value: '✓' },
    ],
    badges: [
      { kind: 'template', label: '📝 Бэлэн загвар' },
      { kind: 'real', label: '🗄️ Бодит өгөгдөл' },
    ],
    draft: `НАРАНТУУЛ СӨХ — 4-Р САРЫН ХУРАЛДААНЫ ТАЙЛАН

Огноо: 2026.04.30
Гаргасан: Ц. Цэрэндулам (СӨХ-ийн дарга)
Хүлээн авагч: СӨХ-ийн Зөвлөл

1. САНХҮҮ
   Орлого: 7,800,000₮ (төлөвлөгөөний 72%)
   Зардал: 5,400,000₮ (төсвөөс -8%)
   Үлдэгдэл: 2,400,000₮

2. ӨРИЙН ТАЙЛАН
   Нийт өр: 4,850,000₮ (35 айл)
   Их өртэй: 2 айл (А-101, B-301)
   Авч буй арга хэмжээ: биечлэн уулзалт

3. ҮЙЛ АЖИЛЛАГАА
   Зарлал: 3 · Засвар: 8 (5 шийдсэн) · Гомдол: 3

4. САНАЛ
   • Лифтний үндсэн засвар (А блок) — 800,000₮
   • Reserve fund-д сар бүр 5% хуваарилах
   • Зуны цагийн нийтлэг засвар

Гарын үсэг: ______________`,
  },
];

// ── Гомдол / Санал ──
export const complaints = [
  { id: 1, title: 'Орцны хог цаг тухайд гарахгүй байна', resident: 'О.Оюунаа (B-301)', type: 'Гомдол', status: 'new', date: '04.08' },
  { id: 2, title: 'Хүүхдийн тоглоомын талбай засуулах санал', resident: 'Д.Сараа (A-203)', type: 'Санал', status: 'review', date: '04.06' },
  { id: 3, title: 'Цахилгааны тоолуур заалт буруу', resident: 'Г.Ганбаатар (B-105)', type: 'Гомдол', status: 'resolved', date: '04.03' },
];

// ── Ашиглалт (тоолуур) ──
export const utilities = [
  { id: 1, label: 'Цэвэр ус', icon: '💧', total: '1,240 м³', change: '+4%', cls: 'text-blue-600' },
  { id: 2, label: 'Дулаан', icon: '🔥', total: '38,500 кВт·ц', change: '-2%', cls: 'text-red-500' },
  { id: 3, label: 'Цахилгаан (нийтийн)', icon: '⚡', total: '6,800 кВт·ц', change: '+1%', cls: 'text-amber-600' },
];
export const utilityReadings = [
  { apt: 'A-101', water: '12.5 м³', elec: '215 кВт·ц', submitted: true },
  { apt: 'A-203', water: '9.0 м³', elec: '180 кВт·ц', submitted: true },
  { apt: 'B-105', water: '14.2 м³', elec: '240 кВт·ц', submitted: false },
  { apt: 'B-301', water: '11.0 м³', elec: '205 кВт·ц', submitted: true },
];

// ── Ажилчид ──
export const staff = [
  { id: 1, name: 'Б. Болормаа', role: 'Нярав', phone: '9911-0011', status: 'Идэвхтэй' },
  { id: 2, name: 'Д. Дорж', role: 'Сантехникч', phone: '9911-0022', status: 'Идэвхтэй' },
  { id: 3, name: 'Ц. Цогт', role: 'Харуул', phone: '9911-0033', status: 'Идэвхтэй' },
  { id: 4, name: 'Г. Гэрэл', role: 'Цэвэрлэгч', phone: '9911-0044', status: 'Чөлөөтэй' },
];

// ── Яаралтай ──
export const emergencyContacts = [
  { label: 'Онцгой байдал', number: '105', icon: '🚒' },
  { label: 'Цагдаа', number: '102', icon: '🚓' },
  { label: 'Түргэн тусламж', number: '103', icon: '🚑' },
  { label: 'СӨХ жижүүр', number: '9911-2233', icon: '🛠' },
];
export const emergencyAlerts = [
  { id: 1, title: 'Гал түймрийн дохиолол шалгалт', date: '04.02', status: 'Дууссан' },
  { id: 2, title: 'Цэвэр ус түр хаагдана (засвар)', date: '04.08', status: 'Идэвхтэй' },
];

// ── Санал хураалт ──
export const polls = [
  {
    id: 1, title: 'Зогсоолын хаалга автоматжуулах уу?', status: 'active', total: 86,
    options: [{ label: 'Тийм', votes: 61 }, { label: 'Үгүй', votes: 17 }, { label: 'Мэдэхгүй', votes: 8 }],
  },
  {
    id: 2, title: 'Цэцэрлэгжүүлэлтэд сар бүр 2000₮ нэмэх үү?', status: 'closed', total: 102,
    options: [{ label: 'Дэмжье', votes: 74 }, { label: 'Эсрэг', votes: 28 }],
  },
];

// ── Мессеж ──
export const messageThreads = [
  { id: 1, name: 'Б. Батболд (A-101)', last: 'Төлбөрөө хэзээ хийх вэ гэж...', time: '14:30', unread: 2 },
  { id: 2, name: 'Д. Сараа (A-203)', last: 'Баярлалаа, ойлголоо', time: '12:05', unread: 0 },
  { id: 3, name: 'Г. Ганбаатар (B-105)', last: 'Лифт хэзээ засагдах вэ?', time: 'Өчигдөр', unread: 1 },
];

// ── Хөрш маркет ──
export const marketplaceItems = [
  { id: 1, title: 'Хүүхдийн тэрэг (бараг шинэ)', seller: 'A-203', price: '150,000₮', emoji: '🚼' },
  { id: 2, title: 'Угаалгын машин Samsung', seller: 'B-105', price: '350,000₮', emoji: '🌀' },
  { id: 3, title: 'Номын тавиур', seller: 'C-402', price: '80,000₮', emoji: '📚' },
  { id: 4, title: 'Унадаг дугуй 26"', seller: 'A-505', price: '220,000₮', emoji: '🚲' },
];

// ── Зай захиалга ──
export const bookableSpaces = [
  { id: 1, name: 'Хурлын танхим', emoji: '🪑', today: 2, status: 'Чөлөөтэй' },
  { id: 2, name: 'Биеийн тамирын өрөө', emoji: '🏋', today: 5, status: 'Завгүй' },
  { id: 3, name: 'Дээврийн талбай', emoji: '🌇', today: 0, status: 'Чөлөөтэй' },
];
export const bookings = [
  { id: 1, space: 'Хурлын танхим', who: 'Д.Сараа (A-203)', when: 'Өнөөдөр 18:00–20:00' },
  { id: 2, space: 'Биеийн тамирын өрөө', who: 'Т.Тамир (B-404)', when: 'Маргааш 07:00–08:00' },
];

// ── Санхүү (төсөв / нөөц сан) ──
export const financeSummary = {
  budget: 6500000, spent: 5400000, reserveFund: 12400000, reserveTarget: 20000000,
};
export const financeLedger = [
  { id: 1, label: 'Сарын хураамж (орлого)', amount: 6200000, type: 'in', date: '04.30' },
  { id: 2, label: 'Лифт засвар (А блок)', amount: 800000, type: 'out', date: '04.22' },
  { id: 3, label: 'Цэвэрлэгээний цалин', amount: 900000, type: 'out', date: '04.15' },
  { id: 4, label: 'Зогсоолын хураамж', amount: 1100000, type: 'in', date: '04.10' },
];

// ── Илгээмж ──
export const packages = [
  { id: 1, apt: 'A-101', from: 'Шуудан', arrived: '04.08 13:20', status: 'waiting' },
  { id: 2, apt: 'C-402', from: 'GoGo', arrived: '04.08 10:05', status: 'waiting' },
  { id: 3, apt: 'B-301', from: 'Шарга маркет', arrived: '04.07 16:40', status: 'picked' },
];

// ── Дэлгүүр & Автомат машин ──
export const shops = [
  { id: 1, name: 'Орцны дэлгүүр', type: 'Дэлгүүр', floor: '1 давхар', status: 'Идэвхтэй' },
  { id: 2, name: 'Кофе автомат', type: 'Vending', floor: 'Орц A', status: 'Идэвхтэй' },
  { id: 3, name: 'Ус борлуулагч', type: 'Vending', floor: 'Орц B', status: 'Засвартай' },
];

// ── Камер (CCTV) ──
export const cameras = [
  { id: 1, name: 'Орц A — гадна', status: 'online' },
  { id: 2, name: 'Орц B — гадна', status: 'online' },
  { id: 3, name: 'Зогсоол — баруун', status: 'online' },
  { id: 4, name: 'Лифт A', status: 'offline' },
  { id: 5, name: 'Хогийн цэг', status: 'online' },
  { id: 6, name: 'Тоглоомын талбай', status: 'online' },
];

// ── Файл импорт ──
export const importHistory = [
  { id: 1, file: 'residents_2026_04.xlsx', rows: 124, status: 'done', date: '04.01' },
  { id: 2, file: 'payments_qpay_0408.csv', rows: 58, status: 'done', date: '04.08' },
  { id: 3, file: 'meters_april.xlsx', rows: 0, status: 'error', date: '04.05' },
];

// ── СӨХ Directory ──
export const directoryStats = { total: 1198, claimed: 43, thisKhoroo: 12 };
export const directorySample = [
  { id: 1, name: 'Нарантуул СӨХ', district: 'Баянгол', khoroo: '1-р хороо', claimed: true },
  { id: 2, name: 'Эрин СӨХ', district: 'Баянгол', khoroo: '1-р хороо', claimed: false },
  { id: 3, name: 'Цэцэг хороолол СӨХ', district: 'Сүхбаатар', khoroo: '6-р хороо', claimed: false },
];

// ── Эрэлт ──
export const demandStats = { interested: 37, residents: 124, percent: 30 };
export const demandFeed = [
  { id: 1, who: 'A-101', action: 'Апп суулгасан', date: '04.08' },
  { id: 2, who: 'B-301', action: 'Апп суулгасан', date: '04.07' },
  { id: 3, who: 'C-402', action: 'Урилга хүлээж авсан', date: '04.06' },
];

// ── Лифт засвар ──
export const elevators = [
  { id: 1, name: 'Лифт A', status: 'maintenance', lastService: '04.08', note: 'Хаалганы мотор солих' },
  { id: 2, name: 'Лифт B', status: 'ok', lastService: '03.20', note: '—' },
  { id: 3, name: 'Лифт C', status: 'ok', lastService: '03.20', note: '—' },
];

// ── Автомат дүрэм (workflows) ──
export const workflowRules = [
  { id: 1, name: 'Төлбөр хоцролт → сануулга', trigger: 'Нэхэмжлэл 5 хоног хоцроход', action: 'SMS ноорог үүсгэх', enabled: true },
  { id: 2, name: 'Шинэ гомдол → хариуцагч', trigger: 'Гомдол ирэхэд', action: 'Холбогдох ажилтанд оноох', enabled: true },
  { id: 3, name: 'Сарын тайлан', trigger: 'Сар бүрийн 1-нд', action: 'Тайлангийн ноорог бэлдэх', enabled: false },
];
export const reviewQueue = [
  { id: 1, title: 'Өртэй 35 айлд сануулга (SMS)', rule: 'Төлбөр хоцролт', date: '04.08' },
  { id: 2, title: '4-р сарын тайлангийн ноорог', rule: 'Сарын тайлан', date: '04.08' },
];

// ── Үйлчилгээ тохиргоо (feature toggles) ──
export const featureToggles = [
  { id: 'parking', label: 'Зогсоол удирдлага', on: true },
  { id: 'easybox', label: 'EasyBox', on: true },
  { id: 'marketplace', label: 'Хөрш маркет', on: true },
  { id: 'cctv', label: 'Камер (CCTV)', on: true },
  { id: 'booking', label: 'Зай захиалга', on: false },
  { id: 'shops', label: 'Дэлгүүр & Автомат', on: false },
];
