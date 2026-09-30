export type Allegiance = 'good' | 'evil'

export type RoleId =
  | 'merlin'
  | 'percival'
  | 'servant'
  | 'lover1'
  | 'lover2'
  | 'assassin'
  | 'morgana'
  | 'mordred'
  | 'oberon'

export interface RoleDef {
  id: RoleId
  name: string
  nickname: string
  title: string
  allegiance: Allegiance
  summary: string
  lore: string
  ability: string
  canInquire: boolean
}

export const ROLES: Record<RoleId, RoleDef> = {
  merlin: {
    id: 'merlin',
    name: 'مرلین',
    nickname: 'چشم شهر',
    title: 'شهر · ویژه',
    allegiance: 'good',
    summary: 'مافیا را می‌بینی (به‌جز موردرد)',
    lore: 'تو مرلین هستی و با شهر هستی. با استعلام، اسم مافیاها را می‌بینی. اگر موردرد در بازی باشد او را نمی‌بینی. مواظب باش اساسین تو را پیدا نکند.',
    ability: 'استعلام: لیست مافیا (موردرد مخفی است).',
    canInquire: true,
  },
  percival: {
    id: 'percival',
    name: 'پرسیوال',
    nickname: 'محافظ مرلین',
    title: 'شهر · ویژه',
    allegiance: 'good',
    summary: 'مرلین و مورگانا را می‌بینی — نمی‌دانی کدام‌اند',
    lore: 'تو پرسیوال هستی و با شهر هستی. دو نفر را می‌بینی که یکی مرلین است و یکی مورگانا. باید حدس بزنی کدام دوست توست.',
    ability: 'استعلام: دو اسم (مرلین + مورگانا، بدون برچسب).',
    canInquire: true,
  },
  servant: {
    id: 'servant',
    name: 'خدمتگزار آرتور',
    nickname: 'شهر ساده',
    title: 'شهر · ساده',
    allegiance: 'good',
    summary: 'نقش معمولی شهر — بدون استعلام',
    lore: 'تو خدمتگزار آرتور هستی؛ یعنی شهر ساده‌ای. هیچ قدرت خاصی نداری. از حرف‌ها و رأی‌ها بفهم چه کسی مافیاست.',
    ability: 'توانایی ویژه نداری. فقط با شهر رأی بده و حرف بزن.',
    canInquire: false,
  },
  lover1: {
    id: 'lover1',
    name: 'لاور اول',
    nickname: 'جفت شهر',
    title: 'شهر · ویژه',
    allegiance: 'good',
    summary: 'لاور دوم را می‌شناسی',
    lore: 'تو لاور اول هستی و با شهر هستی. فقط لاور دوم را می‌شناسی و او هم تو را می‌شناسد.',
    ability: 'استعلام: اسم لاور دوم.',
    canInquire: true,
  },
  lover2: {
    id: 'lover2',
    name: 'لاور دوم',
    nickname: 'جفت شهر',
    title: 'شهر · ویژه',
    allegiance: 'good',
    summary: 'لاور اول را می‌شناسی',
    lore: 'تو لاور دوم هستی و با شهر هستی. فقط لاور اول را می‌شناسی و او هم تو را می‌شناسد.',
    ability: 'استعلام: اسم لاور اول.',
    canInquire: true,
  },
  assassin: {
    id: 'assassin',
    name: 'اَساسین',
    nickname: 'قاتل',
    title: 'مافیا · ویژه',
    allegiance: 'evil',
    summary: 'یارهای مافیا را می‌بینی؛ آخر بازی می‌توانی مرلین را بزنی',
    lore: 'تو اساسین (قاتل) هستی و با مافیا هستی. یارهایت را می‌شناسی. اگر شهر ۳ مأموریت ببرد، یک شانس داری مرلین را حدس بزنی و بازی را بدزدی.',
    ability: 'استعلام: یارهای مافیا. پایان بازی: شلیک به مرلین.',
    canInquire: true,
  },
  morgana: {
    id: 'morgana',
    name: 'مورگانا',
    nickname: 'نقاب مرلین',
    title: 'مافیا · ویژه',
    allegiance: 'evil',
    summary: 'برای پرسیوال مثل مرلین دیده می‌شوی',
    lore: 'تو مورگانا هستی و با مافیا هستی. یارهایت را می‌شناسی. پرسیوال تو را همراه مرلین می‌بیند و ممکن است گیج شود.',
    ability: 'استعلام: یارهای مافیا. ظاهر شدن به‌جای مرلین نزد پرسیوال.',
    canInquire: true,
  },
  mordred: {
    id: 'mordred',
    name: 'موردرد',
    nickname: 'پدرخوانده',
    title: 'مافیا · ویژه',
    allegiance: 'evil',
    summary: 'مرلین تو را نمی‌بیند',
    lore: 'تو موردرد (پدرخوانده) هستی و با مافیا هستی. یارهایت را می‌شناسی، ولی مرلین تو را در استعلام نمی‌بیند.',
    ability: 'استعلام: یارهای مافیا. مخفی ماندن از چشم مرلین.',
    canInquire: true,
  },
  oberon: {
    id: 'oberon',
    name: 'اُبرون',
    nickname: 'مافیای تنها',
    title: 'مافیا · تنها',
    allegiance: 'evil',
    summary: 'نه یار می‌بینی، نه یار تو را می‌بیند',
    lore: 'تو اوبرون هستی و با مافیا هستی، ولی تنهایی. هیچ‌کس از تیم مافیا را نمی‌بینی و آن‌ها هم تو را نمی‌بینند.',
    ability: 'استعلام نداری. فقط مأموریت را خراب کن.',
    canInquire: false,
  },
}
