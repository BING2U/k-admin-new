/** Display names for ArtistDetail.company_code. Unknown codes fall back to the code itself. */
export const COMPANY_CODE_NAMES: Record<string, string> = {
  SM: "SM Entertainment",
  YG: "YG Entertainment",
  JYP: "JYP Entertainment",
  HYBE: "HYBE",
  BIGHIT: "Big Hit Music",
  BIG_HIT: "Big Hit Music",
  PLEDIS: "Pledis Entertainment",
  SOURCE: "Source Music",
  SOURCE_MUSIC: "Source Music",
  ADOR: "ADOR",
  BELIFT: "BELIFT LAB",
  BELIFT_LAB: "BELIFT LAB",
  KOZ: "KOZ Entertainment",
  STARSHIP: "Starship Entertainment",
  WOOLLIM: "Woollim Entertainment",
  FNC: "FNC Entertainment",
  CUBE: "Cube Entertainment",
  IST: "IST Entertainment",
  RBW: "RBW",
  P_NATION: "P NATION",
  PNATION: "P NATION",
  THE_BLACK_LABEL: "THE BLACK LABEL",
  THEBLACKLABEL: "THE BLACK LABEL",
  WAKEONE: "WAKEONE",
  KAKAO: "Kakao Entertainment",
  CJENM: "CJ ENM",
  CJ_ENM: "CJ ENM",
  EDAM: "EDAM Entertainment",
  YUEHUA: "Yuehua Entertainment",
  AOMG: "AOMG",
  H1GHR: "H1GHR MUSIC",
  BRANDNEW: "Brand New Music",
  MNH: "MNH Entertainment"
};

function normalizeCode(code: string) {
  return code
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

export function companyNameFromCode(code: string) {
  const raw = code.trim();
  if (!raw) return "";
  return (
    COMPANY_CODE_NAMES[raw] ||
    COMPANY_CODE_NAMES[raw.toUpperCase()] ||
    COMPANY_CODE_NAMES[normalizeCode(raw)] ||
    raw
  );
}

export function formatCompanyLabel(name: string, code: string) {
  const n = name.trim();
  const c = code.trim();
  if (n && c && n !== c && !n.includes(`（${c}）`) && !n.includes(`(${c})`)) {
    return `${n}（${c}）`;
  }
  return n || c || "";
}
