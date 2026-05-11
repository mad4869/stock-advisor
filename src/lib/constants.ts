/**
 * Shared constants for the Stock Advisor application.
 * Extracted from stockData.ts and analysis/route.ts to eliminate duplication.
 */

import { Market, PopularStock } from '@/types';

// ============================================================
// IDX SECTOR MAP
// Used for peer comparison lookups in the Indonesian market.
// ============================================================

export const IDX_SECTOR_MAP: Record<string, string> = {
  // Banking
  BBCA: 'Financial', BBRI: 'Financial', BMRI: 'Financial', BBNI: 'Financial',
  BRIS: 'Financial', BTPS: 'Financial', MEGA: 'Financial', NISP: 'Financial',
  BNGA: 'Financial', BDMN: 'Financial', ARTO: 'Financial', BBYB: 'Financial',
  BNLI: 'Financial', BTPN: 'Financial', BJTM: 'Financial', BJBR: 'Financial',
  ADMF: 'Financial', BBLD: 'Financial', PNLF: 'Financial', LIFE: 'Financial',
  // Mining & Energy
  ADRO: 'Energy', ITMG: 'Energy', PTBA: 'Energy', ANTM: 'Energy',
  INCO: 'Energy', MDKA: 'Energy', MEDC: 'Energy', PGAS: 'Energy',
  ESSA: 'Energy', HRUM: 'Energy', TINS: 'Energy', BSSR: 'Energy',
  DSSA: 'Energy', MBAP: 'Energy', GEMS: 'Energy', UNTR: 'Energy',
  ADMR: 'Energy', PGEO: 'Energy', ELSA: 'Energy',
  // Telco & Tech
  TLKM: 'Technology', EXCL: 'Technology', ISAT: 'Technology',
  EMTK: 'Technology', TOWR: 'Technology', TBIG: 'Technology',
  GOTO: 'Technology', BUKA: 'Technology', DCII: 'Technology', MTDL: 'Technology',
  // Consumer
  ASII: 'Consumer Cyclical', UNVR: 'Consumer Defensive', HMSP: 'Consumer Defensive',
  ICBP: 'Consumer Defensive', INDF: 'Consumer Defensive', KLBF: 'Healthcare',
  GGRM: 'Consumer Defensive', MYOR: 'Consumer Defensive', CPIN: 'Consumer Defensive',
  SIDO: 'Consumer Defensive', ACES: 'Consumer Cyclical', AMRT: 'Consumer Defensive',
  MAPI: 'Consumer Cyclical', ERAA: 'Consumer Cyclical', LPPF: 'Consumer Cyclical',
  HERO: 'Consumer Defensive', RALS: 'Consumer Cyclical', JPFA: 'Consumer Defensive',
  MAIN: 'Consumer Defensive', CLEO: 'Consumer Defensive', AUTO: 'Consumer Cyclical',
  // Property & Construction
  BSDE: 'Real Estate', CTRA: 'Real Estate', SMRA: 'Real Estate',
  PWON: 'Real Estate', WIKA: 'Industrials', PTPP: 'Industrials',
  WSKT: 'Industrials', JSMR: 'Industrials', DILD: 'Real Estate',
  LPKR: 'Real Estate', APLN: 'Real Estate', SMGR: 'Industrials',
  // Industrial
  INKP: 'Industrials', TKIM: 'Industrials', BRPT: 'Industrials',
  TPIA: 'Industrials', IMPC: 'Industrials', SRIL: 'Industrials',
  // Healthcare
  HEAL: 'Healthcare', MIKA: 'Healthcare', SILO: 'Healthcare',
  PRDA: 'Healthcare', DVLA: 'Healthcare',
  // Plantation
  AALI: 'Consumer Defensive', LSIP: 'Consumer Defensive', DSNG: 'Consumer Defensive',
  TAPG: 'Consumer Defensive',
  // Media
  SCMA: 'Communication Services', MNCN: 'Communication Services',
  // Others
  AKRA: 'Energy', GIAA: 'Industrials',
};

// ============================================================
// COMPREHENSIVE IDX STOCK LIST
// ============================================================

export const IDX_FULL_LIST: { symbol: string; name: string }[] = [
  // ===== LQ45 / Blue Chips =====
  { symbol: 'BBCA', name: 'Bank Central Asia' },
  { symbol: 'BBRI', name: 'Bank Rakyat Indonesia' },
  { symbol: 'BMRI', name: 'Bank Mandiri' },
  { symbol: 'BBNI', name: 'Bank Negara Indonesia' },
  { symbol: 'TLKM', name: 'Telkom Indonesia' },
  { symbol: 'ASII', name: 'Astra International' },
  { symbol: 'UNVR', name: 'Unilever Indonesia' },
  { symbol: 'HMSP', name: 'HM Sampoerna' },
  { symbol: 'ICBP', name: 'Indofood CBP Sukses Makmur' },
  { symbol: 'INDF', name: 'Indofood Sukses Makmur' },
  { symbol: 'KLBF', name: 'Kalbe Farma' },
  { symbol: 'GGRM', name: 'Gudang Garam' },
  { symbol: 'SMGR', name: 'Semen Indonesia' },
  // ===== Mining & Energy =====
  { symbol: 'ADRO', name: 'Adaro Energy Indonesia' },
  { symbol: 'ITMG', name: 'Indo Tambangraya Megah' },
  { symbol: 'PTBA', name: 'Bukit Asam' },
  { symbol: 'ANTM', name: 'Aneka Tambang' },
  { symbol: 'INCO', name: 'Vale Indonesia' },
  { symbol: 'MDKA', name: 'Merdeka Copper Gold' },
  { symbol: 'MEDC', name: 'Medco Energi Internasional' },
  { symbol: 'PGAS', name: 'Perusahaan Gas Negara' },
  { symbol: 'ESSA', name: 'Surya Esa Perkasa' },
  { symbol: 'HRUM', name: 'Harum Energy' },
  { symbol: 'TINS', name: 'Timah' },
  { symbol: 'BSSR', name: 'Baramulti Suksessarana' },
  { symbol: 'DSSA', name: 'Dian Swastatika Sentosa' },
  { symbol: 'MBAP', name: 'Mitrabara Adiperdana' },
  { symbol: 'GEMS', name: 'Golden Energy Mines' },
  { symbol: 'UNTR', name: 'United Tractors' },
  { symbol: 'ADMR', name: 'Adaro Minerals Indonesia' },
  { symbol: 'PGEO', name: 'Pertamina Geothermal Energy' },
  // ===== Banking =====
  { symbol: 'BRIS', name: 'Bank Syariah Indonesia' },
  { symbol: 'BTPS', name: 'Bank BTPN Syariah' },
  { symbol: 'MEGA', name: 'Bank Mega' },
  { symbol: 'NISP', name: 'Bank OCBC NISP' },
  { symbol: 'BNGA', name: 'Bank CIMB Niaga' },
  { symbol: 'BDMN', name: 'Bank Danamon Indonesia' },
  { symbol: 'ARTO', name: 'Bank Jago' },
  { symbol: 'BBYB', name: 'Bank Neo Commerce' },
  { symbol: 'BNLI', name: 'Bank Permata' },
  { symbol: 'BTPN', name: 'Bank BTPN' },
  { symbol: 'BJTM', name: 'Bank Jatim' },
  { symbol: 'BJBR', name: 'Bank BJB' },
  // ===== Telco & Technology =====
  { symbol: 'EXCL', name: 'XL Axiata' },
  { symbol: 'ISAT', name: 'Indosat Ooredoo Hutchison' },
  { symbol: 'EMTK', name: 'Elang Mahkota Teknologi' },
  { symbol: 'TOWR', name: 'Sarana Menara Nusantara' },
  { symbol: 'TBIG', name: 'Tower Bersama Infrastructure' },
  { symbol: 'GOTO', name: 'GoTo Gojek Tokopedia' },
  { symbol: 'BUKA', name: 'Bukalapak.com' },
  { symbol: 'DCII', name: 'DCI Indonesia' },
  { symbol: 'MTDL', name: 'Metrodata Electronics' },
  // ===== Consumer & Retail =====
  { symbol: 'MYOR', name: 'Mayora Indah' },
  { symbol: 'CPIN', name: 'Charoen Pokphand Indonesia' },
  { symbol: 'SIDO', name: 'Industri Jamu Sido Muncul' },
  { symbol: 'ACES', name: 'Ace Hardware Indonesia' },
  { symbol: 'AMRT', name: 'Sumber Alfaria Trijaya' },
  { symbol: 'MAPI', name: 'Mitra Adiperkasa' },
  { symbol: 'ERAA', name: 'Erajaya Swasembada' },
  { symbol: 'LPPF', name: 'Matahari Department Store' },
  { symbol: 'HERO', name: 'Hero Supermarket' },
  { symbol: 'RALS', name: 'Ramayana Lestari Sentosa' },
  { symbol: 'JPFA', name: 'Japfa Comfeed Indonesia' },
  { symbol: 'MAIN', name: 'Malindo Feedmill' },
  { symbol: 'CLEO', name: 'Sariguna Primatirta' },
  // ===== Property & Construction =====
  { symbol: 'BSDE', name: 'Bumi Serpong Damai' },
  { symbol: 'CTRA', name: 'Ciputra Development' },
  { symbol: 'SMRA', name: 'Summarecon Agung' },
  { symbol: 'PWON', name: 'Pakuwon Jati' },
  { symbol: 'WIKA', name: 'Wijaya Karya' },
  { symbol: 'PTPP', name: 'PP (Persero)' },
  { symbol: 'WSKT', name: 'Waskita Karya' },
  { symbol: 'JSMR', name: 'Jasa Marga' },
  { symbol: 'DILD', name: 'Intiland Development' },
  { symbol: 'LPKR', name: 'Lippo Karawaci' },
  { symbol: 'APLN', name: 'Agung Podomoro Land' },
  // ===== Industrial & Manufacturing =====
  { symbol: 'INKP', name: 'Indah Kiat Pulp & Paper' },
  { symbol: 'TKIM', name: 'Pabrik Kertas Tjiwi Kimia' },
  { symbol: 'BRPT', name: 'Barito Pacific' },
  { symbol: 'TPIA', name: 'Chandra Asri Petrochemical' },
  { symbol: 'IMPC', name: 'Impack Pratama Industri' },
  { symbol: 'SRIL', name: 'Sri Rejeki Isman' },
  { symbol: 'AUTO', name: 'Astra Otoparts' },
  // ===== Healthcare & Pharma =====
  { symbol: 'HEAL', name: 'Medikaloka Hermina' },
  { symbol: 'MIKA', name: 'Mitra Keluarga Karyasehat' },
  { symbol: 'SILO', name: 'Siloam International Hospitals' },
  { symbol: 'PRDA', name: 'Prodia Widyahusada' },
  { symbol: 'DVLA', name: 'Darya-Varia Laboratoria' },
  // ===== Plantation & Agriculture =====
  { symbol: 'AALI', name: 'Astra Agro Lestari' },
  { symbol: 'LSIP', name: 'PP London Sumatra Indonesia' },
  { symbol: 'DSNG', name: 'Dharma Satya Nusantara' },
  // ===== Media & Entertainment =====
  { symbol: 'SCMA', name: 'Surya Citra Media' },
  { symbol: 'MNCN', name: 'MNC Studios International' },
  // ===== Finance (Non-Bank) =====
  { symbol: 'ADMF', name: 'Adira Dinamika Multi Finance' },
  { symbol: 'BBLD', name: 'Buana Finance' },
  { symbol: 'PNLF', name: 'Panin Financial' },
  { symbol: 'LIFE', name: 'Asuransi Jiwa Sinarmas MSIG' },
  // ===== Others =====
  { symbol: 'AKRA', name: 'AKR Corporindo' },
  { symbol: 'BNBR', name: 'Bakrie & Brothers' },
  { symbol: 'BUMI', name: 'Bumi Resources' },
  { symbol: 'DEWA', name: 'Darma Henwa' },
  { symbol: 'ELSA', name: 'Elnusa' },
  { symbol: 'GIAA', name: 'Garuda Indonesia' },
  { symbol: 'SSIA', name: 'Surya Semesta Internusa' },
  { symbol: 'TMAS', name: 'Pelayaran Tempuran Emas' },
  { symbol: 'TAPG', name: 'Triputra Agro Persada' },
];

// ============================================================
// POPULAR STOCKS (for search fallback and peer comparison)
// ============================================================

export const POPULAR_STOCKS: PopularStock[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', market: 'US', sector: 'Technology' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', market: 'US', sector: 'Technology' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', market: 'US', sector: 'Technology' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', market: 'US', sector: 'Consumer Cyclical' },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', market: 'US', sector: 'Technology' },
  { symbol: 'META', name: 'Meta Platforms Inc.', market: 'US', sector: 'Technology' },
  { symbol: 'TSLA', name: 'Tesla Inc.', market: 'US', sector: 'Consumer Cyclical' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.', market: 'US', sector: 'Financial' },
  { symbol: 'V', name: 'Visa Inc.', market: 'US', sector: 'Financial' },
  { symbol: 'JNJ', name: 'Johnson & Johnson', market: 'US', sector: 'Healthcare' },
  { symbol: 'BBCA', name: 'Bank Central Asia', market: 'ID', sector: 'Financial' },
  { symbol: 'BBRI', name: 'Bank Rakyat Indonesia', market: 'ID', sector: 'Financial' },
  { symbol: 'BMRI', name: 'Bank Mandiri', market: 'ID', sector: 'Financial' },
  { symbol: 'TLKM', name: 'Telkom Indonesia', market: 'ID', sector: 'Telecom' },
  { symbol: 'ASII', name: 'Astra International', market: 'ID', sector: 'Consumer Cyclical' },
  { symbol: 'UNVR', name: 'Unilever Indonesia', market: 'ID', sector: 'Consumer Defensive' },
  { symbol: 'HMSP', name: 'HM Sampoerna', market: 'ID', sector: 'Consumer Defensive' },
  { symbol: 'ICBP', name: 'Indofood CBP', market: 'ID', sector: 'Consumer Defensive' },
  { symbol: 'KLBF', name: 'Kalbe Farma', market: 'ID', sector: 'Healthcare' },
  { symbol: 'ITMG', name: 'Indo Tambangraya Megah', market: 'ID', sector: 'Energy' },
];

// ============================================================
// HELPER: Look up stock name from all lists
// ============================================================

export function lookupStockName(symbol: string): string {
  return (
    IDX_FULL_LIST.find((s) => s.symbol === symbol)?.name ||
    POPULAR_STOCKS.find((s) => s.symbol === symbol)?.name ||
    symbol
  );
}
