import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzInputModule } from 'ng-zorro-antd/input';

export interface NumberTransformConfig {
  fromThousands: string;
  fromDecimal: string;
  toThousands: string;
  toDecimal: string;
  stripCurrency: boolean;
  addCurrency: string;
}

@Component({
  selector: 'app-transform-number',
  standalone: true,
  imports: [CommonModule, FormsModule, NzSelectModule, NzFormModule, NzButtonModule, NzTableModule, NzInputModule],
  template: `
    <div class="transform-dialog">
      <nz-form-item>
        <nz-form-label>From format</nz-form-label>
        <nz-form-control>
          <div class="format-row">
            <label>Thousands separator:</label>
            <nz-select [(ngModel)]="config.fromThousands" style="width: 120px" (ngModelChange)="updatePreview()">
              <nz-option nzValue="" nzLabel="None"></nz-option>
              <nz-option nzValue="," nzLabel="Comma (,)"></nz-option>
              <nz-option nzValue="." nzLabel="Period (.)"></nz-option>
              <nz-option nzValue=" " nzLabel="Space"></nz-option>
            </nz-select>
            <label>Decimal separator:</label>
            <nz-select [(ngModel)]="config.fromDecimal" style="width: 120px" (ngModelChange)="updatePreview()">
              <nz-option nzValue="." nzLabel="Period (.)"></nz-option>
              <nz-option nzValue="," nzLabel="Comma (,)"></nz-option>
            </nz-select>
          </div>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label>To format</nz-form-label>
        <nz-form-control>
          <div class="format-row">
            <label>Thousands separator:</label>
            <nz-select [(ngModel)]="config.toThousands" style="width: 120px" (ngModelChange)="updatePreview()">
              <nz-option nzValue="" nzLabel="None"></nz-option>
              <nz-option nzValue="," nzLabel="Comma (,)"></nz-option>
              <nz-option nzValue="." nzLabel="Period (.)"></nz-option>
              <nz-option nzValue=" " nzLabel="Space"></nz-option>
            </nz-select>
            <label>Decimal separator:</label>
            <nz-select [(ngModel)]="config.toDecimal" style="width: 120px" (ngModelChange)="updatePreview()">
              <nz-option nzValue="." nzLabel="Period (.)"></nz-option>
              <nz-option nzValue="," nzLabel="Comma (,)"></nz-option>
            </nz-select>
          </div>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label>Currency</nz-form-label>
        <nz-form-control>
          <div class="format-row">
            <label>Strip currency symbols</label>
            <input type="checkbox" [(ngModel)]="config.stripCurrency" (ngModelChange)="updatePreview()" />
            <label>Add currency:</label>
            <input nz-input [(ngModel)]="config.addCurrency" placeholder="e.g. $" style="width: 60px" (ngModelChange)="updatePreview()" />
          </div>
        </nz-form-control>
      </nz-form-item>

      @if (preview().length > 0) {
        <div class="preview-section">
          <strong>Preview:</strong>
          <nz-table [nzData]="preview()" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>Before</th>
                <th>After</th>
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
  styles: [`
    .transform-dialog { padding: 8px 0; }
    .format-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .preview-section { margin-top: 16px; }
    nz-form-item { margin-bottom: 12px; }
  `]
})
export class TransformNumberComponent {
  private modalRef = inject(NzModalRef, { optional: true });

  config: NumberTransformConfig = {
    fromThousands: ',',
    fromDecimal: '.',
    toThousands: '.',
    toDecimal: ',',
    stripCurrency: false,
    addCurrency: '',
  };

  inputValues: string[] = [];
  readonly preview = signal<{ before: string; after: string }[]>([]);

  setInputValues(values: string[]): void {
    this.inputValues = values;
    this.updatePreview();
  }

  updatePreview(): void {
    const sample = this.inputValues.slice(0, 5);
    this.preview.set(sample.map(v => ({
      before: v,
      after: this.transformValue(v),
    })));
  }

  transformValue(value: string): string {
    let v = value.trim();
    if (this.config.stripCurrency) {
      v = v.replace(/[$€£¥₹]/g, '').trim();
    }
    if (this.config.fromThousands) {
      v = v.split(this.config.fromThousands).join('');
    }
    if (this.config.fromDecimal !== '.') {
      v = v.replace(this.config.fromDecimal, '.');
    }
    const num = parseFloat(v);
    if (isNaN(num)) return value;
    const parts = num.toFixed(2).split('.');
    if (this.config.toThousands) {
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, this.config.toThousands);
    }
    let result = parts.join(this.config.toDecimal);
    if (this.config.addCurrency) {
      result = this.config.addCurrency + result;
    }
    return result;
  }

  getResult(): { config: NumberTransformConfig; transformer: (v: string) => string } {
    return {
      config: this.config,
      transformer: (v: string) => this.transformValue(v),
    };
  }
}
