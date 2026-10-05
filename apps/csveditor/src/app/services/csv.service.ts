import { Injectable } from '@angular/core';
import { parse } from 'csv-parse/browser/esm/sync';

@Injectable({ providedIn: 'root' })
export class CsvService {
  detectDelimiter(content: string): string {
    const firstLine = content.split('\n')[0] || '';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    if (tabCount >= commaCount && tabCount >= semicolonCount) return '\t';
    if (semicolonCount > commaCount) return ';';
    return ',';
  }

  parseCSV(content: string, delimiter?: string): string[][] {
    const detectedDelimiter = delimiter || this.detectDelimiter(content);
    const records = parse(content, {
      delimiter: detectedDelimiter,
      relax_quotes: true,
      skip_empty_lines: false,
    }) as string[][];
    return records;
  }

  serializeCSV(data: string[][], delimiter = ','): string {
    return data
      .map((row) =>
        row
          .map((cell) => {
            const str = cell ?? '';
            if (str.includes(delimiter) || str.includes('"') || str.includes('\n')) {
              return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
          })
          .join(delimiter),
      )
      .join('\n');
  }
}
