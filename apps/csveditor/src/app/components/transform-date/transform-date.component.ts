import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { T } from '../../i18n';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTableModule } from 'ng-zorro-antd/table';

const DATE_FORMATS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', note: 'dateUs' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', note: 'dateEu' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)', note: null },
  { value: 'DD.MM.YYYY', label: 'DD.MM.YYYY', note: null },
  { value: 'MM-DD-YYYY', label: 'MM-DD-YYYY', note: null },
] as const;

@Component({
  selector: 'app-transform-date',
  standalone: true,
  imports: [CommonModule, FormsModule, NzSelectModule, NzFormModule, NzButtonModule, NzTableModule],
  template: `
    <div class="transform-dialog">
      <nz-form-item>
        <nz-form-label>{{ t().fromFormat }}</nz-form-label>
        <nz-form-control>
          <nz-select
            [(ngModel)]="fromFormat"
            style="width: 200px"
            (ngModelChange)="updatePreview()"
          >
            @for (fmt of dateFormats; track fmt.value) {
              <nz-option
                [nzValue]="fmt.value"
                [nzLabel]="fmt.note ? fmt.label + ' (' + t()[fmt.note] + ')' : fmt.label"
              ></nz-option>
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label>{{ t().toFormat }}</nz-form-label>
        <nz-form-control>
          <nz-select [(ngModel)]="toFormat" style="width: 200px" (ngModelChange)="updatePreview()">
            @for (fmt of dateFormats; track fmt.value) {
              <nz-option
                [nzValue]="fmt.value"
                [nzLabel]="fmt.note ? fmt.label + ' (' + t()[fmt.note] + ')' : fmt.label"
              ></nz-option>
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>

      @if (preview().length > 0) {
        <div class="preview-section">
          <strong>{{ t().preview }}</strong>
          <nz-table [nzData]="preview()" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ t().before }}</th>
                <th>{{ t().after }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of preview(); track $index) {
                <tr>
                  <td>{{ item.before }}</td>
                  <td>{{ item.after }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .transform-dialog {
        padding: 8px 0;
      }
      .preview-section {
        margin-top: 16px;
      }
      nz-form-item {
        margin-bottom: 12px;
      }
    `,
  ],
})
export class TransformDateComponent {
  protected readonly t = T;
  private modalRef = inject(NzModalRef, { optional: true });

  dateFormats = DATE_FORMATS;
  fromFormat = 'MM/DD/YYYY';
  toFormat = 'YYYY-MM-DD';
  inputValues: string[] = [] as const;
  readonly preview = signal<{ before: string; after: string }[]>([]);

  setInputValues(values: string[]): void {
    this.inputValues = values;
    this.updatePreview();
  }

  updatePreview(): void {
    const sample = this.inputValues.slice(0, 5);
    this.preview.set(
      sample.map((v) => ({
        before: v,
        after: this.transformValue(v),
      })),
    );
  }

  parseDate(value: string, format: string): { year: number; month: number; day: number } | null {
    const parts = value.trim().split(/[-/.]/);
    if (parts.length !== 3) return null;
    let year: number, month: number, day: number;

    if (format === 'YYYY-MM-DD') {
      [year, month, day] = parts.map(Number);
    } else if (format === 'MM/DD/YYYY' || format === 'MM-DD-YYYY') {
      [month, day, year] = parts.map(Number);
    } else if (format === 'DD/MM/YYYY' || format === 'DD.MM.YYYY') {
      [day, month, year] = parts.map(Number);
    } else {
      return null;
    }
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    return { year, month, day };
  }

  formatDate(date: { year: number; month: number; day: number }, format: string): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    if (format === 'YYYY-MM-DD') return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
    if (format === 'MM/DD/YYYY') return `${pad(date.month)}/${pad(date.day)}/${date.year}`;
    if (format === 'DD/MM/YYYY') return `${pad(date.day)}/${pad(date.month)}/${date.year}`;
    if (format === 'DD.MM.YYYY') return `${pad(date.day)}.${pad(date.month)}.${date.year}`;
    if (format === 'MM-DD-YYYY') return `${pad(date.month)}-${pad(date.day)}-${date.year}`;
    return `${date.year}-${pad(date.month)}-${pad(date.day)}`;
  }

  transformValue(value: string): string {
    if (!value.trim()) return value;
    const parsed = this.parseDate(value, this.fromFormat);
    if (!parsed) return value;
    return this.formatDate(parsed, this.toFormat);
  }

  getTransformer(): (v: string) => string {
    return (v: string) => this.transformValue(v);
  }
}
