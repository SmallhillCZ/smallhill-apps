import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzTableModule } from 'ng-zorro-antd/table';
import { marked } from 'marked';
import TurndownService from 'turndown';

@Component({
  selector: 'app-transform-markup',
  standalone: true,
  imports: [CommonModule, FormsModule, NzRadioModule, NzFormModule, NzTableModule],
  template: `
    <div class="transform-dialog">
      <nz-form-item>
        <nz-form-label>Conversion direction</nz-form-label>
        <nz-form-control>
          <nz-radio-group [(ngModel)]="direction" (ngModelChange)="updatePreview()">
            <label nz-radio nzValue="html-to-md">HTML → Markdown</label>
            <label nz-radio nzValue="md-to-html">Markdown → HTML</label>
          </nz-radio-group>
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
                  <td><code>{{ item.before }}</code></td>
                  <td><code>{{ item.after }}</code></td>
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
    .preview-section { margin-top: 16px; }
    nz-form-item { margin-bottom: 12px; }
    code { font-size: 11px; word-break: break-all; }
  `]
})
export class TransformMarkupComponent {
  private modalRef = inject(NzModalRef, { optional: true });
  private turndown = new TurndownService();

  direction: 'html-to-md' | 'md-to-html' = 'html-to-md';
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
    if (!value.trim()) return value;
    if (this.direction === 'html-to-md') {
      try {
        return this.turndown.turndown(value);
      } catch {
        // Fallback: strip all HTML tags including multi-line ones
        return value.replace(/<[\s\S]*?>/g, '');
      }
    } else {
      try {
        const result = marked.parse(value);
        return typeof result === 'string' ? result : value;
      } catch {
        return value;
      }
    }
  }

  getTransformer(): (v: string) => string {
    return (v: string) => this.transformValue(v);
  }
}
