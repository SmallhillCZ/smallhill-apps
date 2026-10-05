import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { T } from '../../i18n';
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
  decimalPlaces: number | null;
}

@Component({
  selector: 'app-transform-number',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzSelectModule,
    NzFormModule,
    NzButtonModule,
    NzTableModule,
    NzInputModule,
  ],
  template: `
    <div class="transform-dialog">
      <nz-form-item>
        <nz-form-label>{{ t().fromFormat }}</nz-form-label>
        <nz-form-control>
          <div class="format-row">
            <label>{{ t().thousandsSeparator }}</label>
            <nz-select
              [(ngModel)]="config.fromThousands"
              style="width: 120px"
              (ngModelChange)="updatePreview()"
            >
              <nz-option nzValue="" [nzLabel]="t().none"></nz-option>
              <nz-option nzValue="," [nzLabel]="t().comma"></nz-option>
              <nz-option nzValue="." [nzLabel]="t().period"></nz-option>
              <nz-option nzValue=" " [nzLabel]="t().space"></nz-option>
            </nz-select>
            <label>{{ t().decimalSeparator }}</label>
            <nz-select
              [(ngModel)]="config.fromDecimal"
              style="width: 120px"
              (ngModelChange)="updatePreview()"
            >
              <nz-option nzValue="." [nzLabel]="t().period"></nz-option>
              <nz-option nzValue="," [nzLabel]="t().comma"></nz-option>
            </nz-select>
          </div>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label>{{ t().toFormat }}</nz-form-label>
        <nz-form-control>
          <div class="format-row">
            <label>{{ t().thousandsSeparator }}</label>
            <nz-select
              [(ngModel)]="config.toThousands"
              style="width: 120px"
              (ngModelChange)="updatePreview()"
            >
              <nz-option nzValue="" [nzLabel]="t().none"></nz-option>
              <nz-option nzValue="," [nzLabel]="t().comma"></nz-option>
              <nz-option nzValue="." [nzLabel]="t().period"></nz-option>
              <nz-option nzValue=" " [nzLabel]="t().space"></nz-option>
            </nz-select>
            <label>{{ t().decimalSeparator }}</label>
            <nz-select
              [(ngModel)]="config.toDecimal"
              style="width: 120px"
              (ngModelChange)="updatePreview()"
            >
              <nz-option nzValue="." [nzLabel]="t().period"></nz-option>
              <nz-option nzValue="," [nzLabel]="t().comma"></nz-option>
            </nz-select>
          </div>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label>{{ t().currency }}</nz-form-label>
        <nz-form-control>
          <div class="format-row">
            <label>{{ t().stripCurrency }}</label>
            <input
              type="checkbox"
              [(ngModel)]="config.stripCurrency"
              (ngModelChange)="updatePreview()"
            />
            <label>{{ t().addCurrency }}</label>
            <input
              nz-input
              [(ngModel)]="config.addCurrency"
              [placeholder]="t().currencyPlaceholder"
              style="width: 60px"
              (ngModelChange)="updatePreview()"
            />
          </div>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label>{{ t().decimalPlaces }}</nz-form-label>
        <nz-form-control>
          <div class="format-row">
            <nz-select
              [(ngModel)]="config.decimalPlaces"
              style="width: 120px"
              (ngModelChange)="updatePreview()"
            >
              <nz-option [nzValue]="null" [nzLabel]="t().keepOriginal"></nz-option>
              <nz-option [nzValue]="0" nzLabel="0"></nz-option>
              <nz-option [nzValue]="1" nzLabel="1"></nz-option>
              <nz-option [nzValue]="2" nzLabel="2"></nz-option>
              <nz-option [nzValue]="3" nzLabel="3"></nz-option>
              <nz-option [nzValue]="4" nzLabel="4"></nz-option>
            </nz-select>
          </div>
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
      .format-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
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
export class TransformNumberComponent {
  protected readonly t = T;
  private modalRef = inject(NzModalRef, { optional: true });

  config: NumberTransformConfig = {
    fromThousands: ',',
    fromDecimal: '.',
    toThousands: '.',
    toDecimal: ',',
    stripCurrency: false,
    addCurrency: '',
    decimalPlaces: 2,
  };

  inputValues: string[] = [];
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
    // Use configured decimal places, or preserve original decimal places
    const dp =
      this.config.decimalPlaces !== null
        ? this.config.decimalPlaces
        : (v.split('.')[1]?.length ?? 0);
    const parts = num.toFixed(dp).split('.');
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
