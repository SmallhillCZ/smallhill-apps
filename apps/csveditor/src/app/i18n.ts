import { computed, signal } from '@angular/core';

export type Lang = 'en' | 'cs';

const en = {
  title: 'CSV Editor',
  language: 'Language',
  emptyText: 'Open a CSV file to get started, or drag and drop a file here.',
  openCsvFile: 'Open CSV File',
  open: 'Open',
  openTooltip: 'Open CSV file',
  save: 'Save',
  saveTooltip: 'Save as CSV',
  undo: 'Undo (Ctrl+Z)',
  redo: 'Redo (Ctrl+Y)',
  delimiter: 'Delimiter:',
  headerRow: 'Header row:',
  numbers: 'Numbers',
  numbersTooltip: 'Reformat numbers',
  dates: 'Dates',
  datesTooltip: 'Reformat dates',
  markup: 'Markup',
  formula: 'Formula',
  formulaTooltip: 'Column formula',
  menu: 'Menu',
  theme: 'Theme',
  themes: { auto: 'Auto', light: 'Light', dark: 'Dark' },
  comma: 'Comma (,)',
  semicolon: 'Semicolon (;)',
  tab: 'Tab',
  pipe: 'Pipe (|)',
  period: 'Period (.)',
  space: 'Space',
  none: 'None',
  filter: 'Filter...',
  addColumn: 'Add column',
  addRow: 'Add Row',
  deleteRow: 'Delete row',
  dropHere: 'Drop CSV file here',
  loaded: (name: string, rows: number) => `Loaded ${name} (${rows} rows)`,
  parseFailed: (error: string) => `Failed to parse CSV: ${error}`,
  saved: 'File saved',
  transformApplied: 'Transform applied',
  formulaApplied: 'Formula applied',
  apply: 'Apply',
  cancel: 'Cancel',
  reformatNumbers: 'Reformat Numbers',
  reformatDates: 'Reformat Dates',
  markupConversion: 'HTML ↔ Markdown Conversion',
  columnFormula: 'Column Formula',
  fromFormat: 'From format',
  toFormat: 'To format',
  thousandsSeparator: 'Thousands separator:',
  decimalSeparator: 'Decimal separator:',
  currency: 'Currency',
  stripCurrency: 'Strip currency symbols',
  addCurrency: 'Add currency:',
  currencyPlaceholder: 'e.g. $',
  decimalPlaces: 'Decimal places',
  keepOriginal: 'Keep original',
  preview: 'Preview:',
  previewFirst: 'Preview (first 5 rows):',
  before: 'Before',
  after: 'After',
  row: 'Row',
  result: 'Result',
  direction: 'Conversion direction',
  targetColumn: 'Target column',
  formulaPlaceholder: "e.g. col[0] + ' ' + col[1] or col[2] > 100 ? 'high' : 'low'",
  formulaHintBefore: 'Use',
  formulaHintAfter:
    'to reference column N (0-indexed). Supports arithmetic, string ops, and ternary expressions.',
  dateUs: 'US',
  dateEu: 'EU',
};

const cs: typeof en = {
  title: 'CSV Editor',
  language: 'Jazyk',
  emptyText: 'Začněte otevřením souboru CSV, nebo ho sem přetáhněte.',
  openCsvFile: 'Otevřít soubor CSV',
  open: 'Otevřít',
  openTooltip: 'Otevřít soubor CSV',
  save: 'Uložit',
  saveTooltip: 'Uložit jako CSV',
  undo: 'Zpět (Ctrl+Z)',
  redo: 'Znovu (Ctrl+Y)',
  delimiter: 'Oddělovač:',
  headerRow: 'Řádek záhlaví:',
  numbers: 'Čísla',
  numbersTooltip: 'Přeformátovat čísla',
  dates: 'Data',
  datesTooltip: 'Přeformátovat data',
  markup: 'Značky',
  formula: 'Vzorec',
  formulaTooltip: 'Vzorec pro sloupec',
  menu: 'Nabídka',
  theme: 'Vzhled',
  themes: { auto: 'Automatický', light: 'Světlý', dark: 'Tmavý' },
  comma: 'Čárka (,)',
  semicolon: 'Středník (;)',
  tab: 'Tabulátor',
  pipe: 'Svislítko (|)',
  period: 'Tečka (.)',
  space: 'Mezera',
  none: 'Žádný',
  filter: 'Filtrovat…',
  addColumn: 'Přidat sloupec',
  addRow: 'Přidat řádek',
  deleteRow: 'Smazat řádek',
  dropHere: 'Pusťte soubor CSV sem',
  loaded: (name: string, rows: number) => `Načteno ${name} (řádků: ${rows})`,
  parseFailed: (error: string) => `CSV se nepodařilo načíst: ${error}`,
  saved: 'Soubor uložen',
  transformApplied: 'Úprava použita',
  formulaApplied: 'Vzorec použit',
  apply: 'Použít',
  cancel: 'Zrušit',
  reformatNumbers: 'Přeformátovat čísla',
  reformatDates: 'Přeformátovat data',
  markupConversion: 'Převod HTML ↔ Markdown',
  columnFormula: 'Vzorec pro sloupec',
  fromFormat: 'Z formátu',
  toFormat: 'Do formátu',
  thousandsSeparator: 'Oddělovač tisíců:',
  decimalSeparator: 'Desetinný oddělovač:',
  currency: 'Měna',
  stripCurrency: 'Odstranit symboly měn',
  addCurrency: 'Přidat měnu:',
  currencyPlaceholder: 'např. Kč',
  decimalPlaces: 'Desetinná místa',
  keepOriginal: 'Ponechat původní',
  preview: 'Náhled:',
  previewFirst: 'Náhled (prvních 5 řádků):',
  before: 'Před',
  after: 'Po',
  row: 'Řádek',
  result: 'Výsledek',
  direction: 'Směr převodu',
  targetColumn: 'Cílový sloupec',
  formulaPlaceholder: "např. col[0] + ' ' + col[1] nebo col[2] > 100 ? 'vysoké' : 'nízké'",
  formulaHintBefore: 'Pomocí',
  formulaHintAfter:
    'odkážete na sloupec N (číslováno od 0). Podporuje aritmetiku, práci s textem a podmíněné výrazy.',
  dateUs: 'USA',
  dateEu: 'EU',
};

const STORAGE_KEY = 'csveditor.lang';
export const LANGS: Lang[] = ['en', 'cs'];
const TEXTS: Record<Lang, typeof en> = { en, cs };

export function detectLang(languages: readonly string[]): Lang {
  for (const language of languages) {
    const code = language.toLowerCase().split('-')[0];
    if (code === 'cs' || code === 'sk') return 'cs';
    if (code === 'en') return 'en';
  }
  return 'en';
}

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (LANGS.includes(stored as Lang)) return stored as Lang;
  } catch {}
  if (typeof navigator === 'undefined') return 'en';
  return detectLang(navigator.languages?.length ? navigator.languages : [navigator.language ?? '']);
}

export const lang = signal<Lang>(initialLang());
export const T = computed(() => TEXTS[lang()]);

export function setLang(value: Lang): void {
  lang.set(value);
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {}
}
