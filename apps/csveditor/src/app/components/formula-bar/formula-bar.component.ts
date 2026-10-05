import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { T } from '../../i18n';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzInputModule } from 'ng-zorro-antd/input';

@Component({
  selector: 'app-formula-bar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzFormModule,
    NzSelectModule,
    NzButtonModule,
    NzAlertModule,
    NzTableModule,
    NzInputModule,
  ],
  template: `
    <div class="formula-dialog">
      <nz-form-item>
        <nz-form-label>{{ t().targetColumn }}</nz-form-label>
        <nz-form-control>
          <nz-select [(ngModel)]="targetCol" style="width: 200px" (ngModelChange)="updatePreview()">
            @for (col of columns(); track $index; let i = $index) {
              <nz-option [nzValue]="i" [nzLabel]="col"></nz-option>
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label>{{ t().formula }}</nz-form-label>
        <nz-form-control>
          <textarea
            nz-input
            [(ngModel)]="formula"
            (ngModelChange)="updatePreview()"
            rows="3"
            [placeholder]="t().formulaPlaceholder"
          ></textarea>
          <div class="formula-hint">
            {{ t().formulaHintBefore }} <code>col[N]</code> {{ t().formulaHintAfter }}
          </div>
        </nz-form-control>
      </nz-form-item>

      @if (error()) {
        <nz-alert nzType="error" [nzMessage]="error()!"></nz-alert>
      }

      @if (preview().length > 0) {
        <div class="preview-section">
          <strong>{{ t().previewFirst }}</strong>
          <nz-table [nzData]="preview()" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ t().row }}</th>
                <th>{{ t().result }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of preview(); track $index) {
                <tr>
                  <td>{{ item.row }}</td>
                  <td>{{ item.result }}</td>
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
      .formula-dialog {
        padding: 8px 0;
      }
      .formula-hint {
        margin-top: 4px;
        font-size: 12px;
        color: #8c8c8c;
      }
      code {
        background: #f5f5f5;
        padding: 1px 4px;
        border-radius: 2px;
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
export class FormulaBarComponent {
  protected readonly t = T;
  private modalRef = inject(NzModalRef, { optional: true });

  readonly columns = signal<string[]>([]);
  targetCol = 0;
  formula = '';
  data: string[][] = [];
  readonly preview = signal<{ row: number; result: string }[]>([]);
  readonly error = signal<string | null>(null);

  setData(data: string[][], columns: string[]): void {
    this.data = data;
    this.columns.set(columns);
  }

  evaluateFormula(row: string[], formulaStr: string): string {
    const col = row;
    // NOTE: new Function() executes user-provided expressions intentionally.
    // This is a power-user feature; only the local user's own data is affected.
    // Global scope is shadowed to limit accidental access.
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      'col',
      'window',
      'document',
      'globalThis',
      `"use strict"; return String(${formulaStr});`,
    );
    return fn(col, undefined, undefined, undefined);
  }

  updatePreview(): void {
    this.error.set(null);
    if (!this.formula.trim()) {
      this.preview.set([]);
      return;
    }
    const sample = this.data.slice(0, 5);
    try {
      this.preview.set(
        sample.map((row, i) => ({
          row: i + 1,
          result: this.evaluateFormula(row, this.formula),
        })),
      );
    } catch (e) {
      this.error.set((e as Error).message);
      this.preview.set([]);
    }
  }

  getResult(): { targetCol: number; formula: string; transformer: (row: string[]) => string } {
    return {
      targetCol: this.targetCol,
      formula: this.formula,
      transformer: (row: string[]) => this.evaluateFormula(row, this.formula),
    };
  }
}
