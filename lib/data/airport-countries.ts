/**
 * Hardcoded IATA → ISO 3166-1 alpha-2 country code lookup.
 * Used as the single source of truth for DOM/INT classification when
 * airport.country_id is NULL or the countries table isn't joined.
 *
 * Covers: all Vietnamese domestic airports + major SE Asian, Asian,
 * Middle Eastern, European, Oceanian, African, and American hubs that
 * a Vietnamese carrier might operate to.
 */

export const AIRPORT_COUNTRY: Record<string, string> = {
  // ─── Vietnam (VN) ───────────────────────────────────────────
  SGN: 'VN', // Ho Chi Minh City - Tan Son Nhat
  HAN: 'VN', // Hanoi - Noi Bai
  DAD: 'VN', // Da Nang
  CXR: 'VN', // Nha Trang - Cam Ranh
  PQC: 'VN', // Phu Quoc
  HPH: 'VN', // Hai Phong - Cat Bi
  HUI: 'VN', // Hue - Phu Bai
  VII: 'VN', // Vinh
  BMV: 'VN', // Buon Ma Thuot
  DLI: 'VN', // Da Lat - Lien Khuong
  UIH: 'VN', // Quy Nhon - Phu Cat
  VCA: 'VN', // Can Tho
  VDO: 'VN', // Van Don (Quang Ninh)
  THD: 'VN', // Thanh Hoa - Tho Xuan
  TBB: 'VN', // Tuy Hoa - Dong Tac
  VCL: 'VN', // Chu Lai
  PXU: 'VN', // Pleiku
  DIN: 'VN', // Dien Bien Phu
  VCS: 'VN', // Con Dao
  CAH: 'VN', // Ca Mau
  VKG: 'VN', // Rach Gia
  PHA: 'VN', // Phan Rang (Ninh Thuan)
  SQH: 'VN', // Son La - Na San
  CON: 'VN', // Con Son (alt code)

  // ─── Thailand (TH) ─────────────────────────────────────────
  BKK: 'TH', // Bangkok - Suvarnabhumi
  DMK: 'TH', // Bangkok - Don Mueang
  CNX: 'TH', // Chiang Mai
  HKT: 'TH', // Phuket
  CEI: 'TH', // Chiang Rai
  USM: 'TH', // Koh Samui
  KBV: 'TH', // Krabi
  HDY: 'TH', // Hat Yai
  UTH: 'TH', // Udon Thani
  UTP: 'TH', // U-Tapao (Pattaya)

  // ─── Singapore (SG) ────────────────────────────────────────
  SIN: 'SG', // Singapore Changi

  // ─── Malaysia (MY) ─────────────────────────────────────────
  KUL: 'MY', // Kuala Lumpur
  PEN: 'MY', // Penang
  BKI: 'MY', // Kota Kinabalu
  KCH: 'MY', // Kuching
  LGK: 'MY', // Langkawi
  JHB: 'MY', // Johor Bahru - Senai
  SZB: 'MY', // Sultan Abdul Aziz Shah (Subang)

  // ─── Indonesia (ID) ────────────────────────────────────────
  CGK: 'ID', // Jakarta - Soekarno-Hatta
  DPS: 'ID', // Bali - Ngurah Rai
  SUB: 'ID', // Surabaya
  UPG: 'ID', // Makassar
  JOG: 'ID', // Yogyakarta (old)
  YIA: 'ID', // Yogyakarta (new)
  MDC: 'ID', // Manado
  BPN: 'ID', // Balikpapan
  PLM: 'ID', // Palembang
  BTH: 'ID', // Batam

  // ─── Philippines (PH) ──────────────────────────────────────
  MNL: 'PH', // Manila - Ninoy Aquino
  CEB: 'PH', // Cebu - Mactan
  CRK: 'PH', // Clark
  DVO: 'PH', // Davao

  // ─── Myanmar (MM) ──────────────────────────────────────────
  RGN: 'MM', // Yangon
  MDL: 'MM', // Mandalay

  // ─── Cambodia (KH) ─────────────────────────────────────────
  PNH: 'KH', // Phnom Penh
  REP: 'KH', // Siem Reap
  KOS: 'KH', // Sihanoukville (new)

  // ─── Laos (LA) ─────────────────────────────────────────────
  VTE: 'LA', // Vientiane
  LPQ: 'LA', // Luang Prabang

  // ─── Brunei (BN) ───────────────────────────────────────────
  BWN: 'BN', // Bandar Seri Begawan

  // ─── China (CN) ────────────────────────────────────────────
  PEK: 'CN', // Beijing Capital
  PKX: 'CN', // Beijing Daxing
  PVG: 'CN', // Shanghai Pudong
  SHA: 'CN', // Shanghai Hongqiao
  CAN: 'CN', // Guangzhou
  SZX: 'CN', // Shenzhen
  CTU: 'CN', // Chengdu Shuangliu
  TFU: 'CN', // Chengdu Tianfu
  CKG: 'CN', // Chongqing
  KMG: 'CN', // Kunming
  XIY: 'CN', // Xi'an
  NNG: 'CN', // Nanning
  CSX: 'CN', // Changsha
  WUH: 'CN', // Wuhan
  HGH: 'CN', // Hangzhou
  NKG: 'CN', // Nanjing
  TAO: 'CN', // Qingdao
  DLC: 'CN', // Dalian
  XMN: 'CN', // Xiamen
  FOC: 'CN', // Fuzhou
  HFE: 'CN', // Hefei
  CGO: 'CN', // Zhengzhou
  TSN: 'CN', // Tianjin
  SYX: 'CN', // Sanya
  HAK: 'CN', // Haikou
  URC: 'CN', // Urumqi
  KWE: 'CN', // Guiyang
  KWL: 'CN', // Guilin
  ZUH: 'CN', // Zhuhai

  // ─── Hong Kong (HK) ───────────────────────────────────────
  HKG: 'HK', // Hong Kong

  // ─── Macau (MO) ────────────────────────────────────────────
  MFM: 'MO', // Macau

  // ─── Taiwan (TW) ───────────────────────────────────────────
  TPE: 'TW', // Taipei Taoyuan
  TSA: 'TW', // Taipei Songshan
  KHH: 'TW', // Kaohsiung

  // ─── Japan (JP) ────────────────────────────────────────────
  NRT: 'JP', // Tokyo Narita
  HND: 'JP', // Tokyo Haneda
  KIX: 'JP', // Osaka Kansai
  ITM: 'JP', // Osaka Itami
  NGO: 'JP', // Nagoya Chubu
  FUK: 'JP', // Fukuoka
  CTS: 'JP', // Sapporo Chitose
  OKA: 'JP', // Okinawa Naha

  // ─── South Korea (KR) ─────────────────────────────────────
  ICN: 'KR', // Seoul Incheon
  GMP: 'KR', // Seoul Gimpo
  PUS: 'KR', // Busan Gimhae
  CJU: 'KR', // Jeju

  // ─── India (IN) ────────────────────────────────────────────
  DEL: 'IN', // Delhi
  BOM: 'IN', // Mumbai
  BLR: 'IN', // Bengaluru
  MAA: 'IN', // Chennai
  CCU: 'IN', // Kolkata
  HYD: 'IN', // Hyderabad
  COK: 'IN', // Kochi
  GOI: 'IN', // Goa
  AMD: 'IN', // Ahmedabad
  TRV: 'IN', // Thiruvananthapuram

  // ─── Sri Lanka (LK) ───────────────────────────────────────
  CMB: 'LK', // Colombo

  // ─── Bangladesh (BD) ──────────────────────────────────────
  DAC: 'BD', // Dhaka

  // ─── Nepal (NP) ────────────────────────────────────────────
  KTM: 'NP', // Kathmandu

  // ─── Pakistan (PK) ────────────────────────────────────────
  ISB: 'PK', // Islamabad
  KHI: 'PK', // Karachi
  LHE: 'PK', // Lahore

  // ─── UAE (AE) ──────────────────────────────────────────────
  DXB: 'AE', // Dubai
  AUH: 'AE', // Abu Dhabi
  SHJ: 'AE', // Sharjah

  // ─── Qatar (QA) ────────────────────────────────────────────
  DOH: 'QA', // Doha

  // ─── Saudi Arabia (SA) ─────────────────────────────────────
  JED: 'SA', // Jeddah
  RUH: 'SA', // Riyadh
  DMM: 'SA', // Dammam

  // ─── Bahrain (BH) ─────────────────────────────────────────
  BAH: 'BH', // Bahrain

  // ─── Kuwait (KW) ──────────────────────────────────────────
  KWI: 'KW', // Kuwait

  // ─── Oman (OM) ─────────────────────────────────────────────
  MCT: 'OM', // Muscat

  // ─── Turkey (TR) ───────────────────────────────────────────
  IST: 'TR', // Istanbul
  SAW: 'TR', // Istanbul Sabiha Gokcen
  ESB: 'TR', // Ankara
  AYT: 'TR', // Antalya

  // ─── Israel (IL) ───────────────────────────────────────────
  TLV: 'IL', // Tel Aviv

  // ─── Russia (RU) ──────────────────────────────────────────
  SVO: 'RU', // Moscow Sheremetyevo
  DME: 'RU', // Moscow Domodedovo
  LED: 'RU', // St. Petersburg
  VVO: 'RU', // Vladivostok

  // ─── Australia (AU) ───────────────────────────────────────
  SYD: 'AU', // Sydney
  MEL: 'AU', // Melbourne
  BNE: 'AU', // Brisbane
  PER: 'AU', // Perth
  ADL: 'AU', // Adelaide

  // ─── New Zealand (NZ) ─────────────────────────────────────
  AKL: 'NZ', // Auckland
  WLG: 'NZ', // Wellington
  CHC: 'NZ', // Christchurch

  // ─── United Kingdom (GB) ──────────────────────────────────
  LHR: 'GB', // London Heathrow
  LGW: 'GB', // London Gatwick
  STN: 'GB', // London Stansted
  MAN: 'GB', // Manchester
  EDI: 'GB', // Edinburgh

  // ─── France (FR) ──────────────────────────────────────────
  CDG: 'FR', // Paris Charles de Gaulle
  ORY: 'FR', // Paris Orly

  // ─── Germany (DE) ─────────────────────────────────────────
  FRA: 'DE', // Frankfurt
  MUC: 'DE', // Munich
  TXL: 'DE', // Berlin Tegel (closed but still referenced)
  BER: 'DE', // Berlin Brandenburg

  // ─── Netherlands (NL) ─────────────────────────────────────
  AMS: 'NL', // Amsterdam Schiphol

  // ─── Italy (IT) ────────────────────────────────────────────
  FCO: 'IT', // Rome Fiumicino
  MXP: 'IT', // Milan Malpensa

  // ─── Spain (ES) ────────────────────────────────────────────
  MAD: 'ES', // Madrid
  BCN: 'ES', // Barcelona

  // ─── Switzerland (CH) ─────────────────────────────────────
  ZRH: 'CH', // Zurich
  GVA: 'CH', // Geneva

  // ─── Belgium (BE) ─────────────────────────────────────────
  BRU: 'BE', // Brussels

  // ─── Austria (AT) ─────────────────────────────────────────
  VIE: 'AT', // Vienna

  // ─── Czech Republic (CZ) ──────────────────────────────────
  PRG: 'CZ', // Prague

  // ─── Poland (PL) ──────────────────────────────────────────
  WAW: 'PL', // Warsaw

  // ─── Denmark (DK) ─────────────────────────────────────────
  CPH: 'DK', // Copenhagen

  // ─── Sweden (SE) ──────────────────────────────────────────
  ARN: 'SE', // Stockholm Arlanda

  // ─── Norway (NO) ──────────────────────────────────────────
  OSL: 'NO', // Oslo

  // ─── Finland (FI) ─────────────────────────────────────────
  HEL: 'FI', // Helsinki

  // ─── Portugal (PT) ────────────────────────────────────────
  LIS: 'PT', // Lisbon

  // ─── Ireland (IE) ─────────────────────────────────────────
  DUB: 'IE', // Dublin

  // ─── Greece (GR) ──────────────────────────────────────────
  ATH: 'GR', // Athens

  // ─── Hungary (HU) ─────────────────────────────────────────
  BUD: 'HU', // Budapest

  // ─── Romania (RO) ─────────────────────────────────────────
  OTP: 'RO', // Bucharest

  // ─── USA (US) ──────────────────────────────────────────────
  JFK: 'US', // New York JFK
  EWR: 'US', // Newark
  LAX: 'US', // Los Angeles
  SFO: 'US', // San Francisco
  ORD: 'US', // Chicago O'Hare
  IAD: 'US', // Washington Dulles
  ATL: 'US', // Atlanta
  DFW: 'US', // Dallas/Fort Worth
  SEA: 'US', // Seattle
  IAH: 'US', // Houston
  MIA: 'US', // Miami
  BOS: 'US', // Boston
  DEN: 'US', // Denver
  MSP: 'US', // Minneapolis
  DTW: 'US', // Detroit
  PHX: 'US', // Phoenix
  LAS: 'US', // Las Vegas
  MCO: 'US', // Orlando
  HNL: 'US', // Honolulu

  // ─── Canada (CA) ──────────────────────────────────────────
  YVR: 'CA', // Vancouver
  YYZ: 'CA', // Toronto
  YUL: 'CA', // Montreal

  // ─── Mexico (MX) ──────────────────────────────────────────
  MEX: 'MX', // Mexico City
  CUN: 'MX', // Cancun

  // ─── Brazil (BR) ──────────────────────────────────────────
  GRU: 'BR', // Sao Paulo
  GIG: 'BR', // Rio de Janeiro

  // ─── Maldives (MV) ───────────────────────────────────────
  MLE: 'MV', // Male

  // ─── Mongolia (MN) ───────────────────────────────────────
  UBN: 'MN', // Ulaanbaatar (new)
  ULN: 'MN', // Ulaanbaatar Chinggis Khaan

  // ─── Uzbekistan (UZ) ─────────────────────────────────────
  TAS: 'UZ', // Tashkent

  // ─── Kazakhstan (KZ) ─────────────────────────────────────
  ALA: 'KZ', // Almaty
  NQZ: 'KZ', // Nur-Sultan

  // ─── Ethiopia (ET) ───────────────────────────────────────
  ADD: 'ET', // Addis Ababa

  // ─── Kenya (KE) ──────────────────────────────────────────
  NBO: 'KE', // Nairobi

  // ─── South Africa (ZA) ───────────────────────────────────
  JNB: 'ZA', // Johannesburg
  CPT: 'ZA', // Cape Town

  // ─── Egypt (EG) ──────────────────────────────────────────
  CAI: 'EG', // Cairo

  // ─── Morocco (MA) ────────────────────────────────────────
  CMN: 'MA', // Casablanca

  // ─── Fiji (FJ) ───────────────────────────────────────────
  NAN: 'FJ', // Nadi

  // ─── Papua New Guinea (PG) ───────────────────────────────
  POM: 'PG', // Port Moresby

  // ─── East Timor (TL) ─────────────────────────────────────
  DIL: 'TL', // Dili

  // ─── Georgia (GE) ────────────────────────────────────────
  TBS: 'GE', // Tbilisi

  // ─── Azerbaijan (AZ) ─────────────────────────────────────
  GYD: 'AZ', // Baku
}

/**
 * Look up the ISO country code for an IATA airport code.
 * Returns the code from the hardcoded map, or undefined if not found.
 */
export function getCountryForIata(iata: string): string | undefined {
  return AIRPORT_COUNTRY[iata.toUpperCase()]
}

/**
 * Determine if two airports are in the same country.
 * Returns 'domestic' | 'international' | 'unknown'.
 * 'unknown' means one or both airports lack country data.
 */
export function classifyRoute(
  depIata: string,
  arrIata: string,
  extraCountryMap?: Map<string, string>
): 'domestic' | 'international' | 'unknown' {
  const depCountry = AIRPORT_COUNTRY[depIata] ?? extraCountryMap?.get(depIata) ?? null
  const arrCountry = AIRPORT_COUNTRY[arrIata] ?? extraCountryMap?.get(arrIata) ?? null

  if (!depCountry || !arrCountry) return 'unknown'
  return depCountry === arrCountry ? 'domestic' : 'international'
}
