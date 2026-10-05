import { Component, inject, signal, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { GridComponent } from './components/grid/grid.component';
import { ToolbarComponent } from './components/toolbar/toolbar.component';
import { TransformNumberComponent } from './components/transform-number/transform-number.component';
import { TransformDateComponent } from './components/transform-date/transform-date.component';
import { TransformMarkupComponent } from './components/transform-markup/transform-markup.component';
import { FormulaBarComponent } from './components/formula-bar/formula-bar.component';
import { CsvService } from './services/csv.service';
import { HistoryService } from './services/history.service';
import { SelectionState } from './models/selection.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GridComponent,
    ToolbarComponent,
    NzButtonModule,
    NzIconModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private csvService = inject(CsvService);
  private historyService = inject(HistoryService<string[][]>);
  private modal = inject(NzModalService);
  private message = inject(NzMessageService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly data = signal<string[][]>([]);
  readonly hasHeader = signal(true);
  readonly delimiter = signal(',');
  readonly filename = signal('');
  readonly isDarkMode = signal(false);
  readonly isDragOver = signal(false);
  readonly selection = signal<SelectionState>({ activeCell: null, ranges: [] });

  get hasData(): boolean {
    return this.data().length > 0;
  }

  get canUndo(): boolean {
    return this.historyService.canUndo();
  }

  get canRedo(): boolean {
    return this.historyService.canRedo();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        this.undo();
      } else if (event.key === 'y' || (event.shiftKey && event.key === 'z')) {
        event.preventDefault();
        this.redo();
      }
    }
  }

  openFile(): void {
    this.fileInput.nativeElement.value = '';
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.loadFile(file);
  }

  loadFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const detectedDelimiter = this.csvService.detectDelimiter(content);
        this.delimiter.set(detectedDelimiter);
        const parsed = this.csvService.parseCSV(content, detectedDelimiter);
        this.data.set(parsed);
        this.filename.set(file.name);
        this.historyService.clear();
        this.historyService.push(parsed);
        this.message.success(`Loaded ${file.name} (${parsed.length} rows)`);
      } catch (err) {
        this.message.error(`Failed to parse CSV: ${(err as Error).message}`);
      }
    };
    reader.readAsText(file);
  }

  saveFile(delimiter: string): void {
    const csv = this.csvService.serializeCSV(this.data(), delimiter);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.filename() || 'data.csv';
    a.click();
    URL.revokeObjectURL(url);
    this.message.success('File saved');
  }

  onDataChange(newData: string[][]): void {
    this.historyService.push(this.data());
    this.data.set(newData);
  }

  undo(): void {
    const prev = this.historyService.undo();
    if (prev) this.data.set(prev);
  }

  redo(): void {
    const next = this.historyService.redo();
    if (next) this.data.set(next);
  }

  onSelectionChange(sel: SelectionState): void {
    this.selection.set(sel);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.loadFile(file);
  }

  getSelectedValues(): string[] {
    const sel = this.selection();
    const data = this.data();
    const values: string[] = [];
    sel.ranges.forEach((range) => {
      const minR = Math.min(range.start.row, range.end.row);
      const maxR = Math.max(range.start.row, range.end.row);
      const minC = Math.min(range.start.col, range.end.col);
      const maxC = Math.max(range.start.col, range.end.col);
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (data[r]?.[c] !== undefined) values.push(data[r][c]);
        }
      }
    });
    return values;
  }

  applyTransformToSelection(transformer: (v: string) => string): void {
    const sel = this.selection();
    const newData = this.data().map((row) => [...row]);
    this.historyService.push(this.data());
    sel.ranges.forEach((range) => {
      const minR = Math.min(range.start.row, range.end.row);
      const maxR = Math.max(range.start.row, range.end.row);
      const minC = Math.min(range.start.col, range.end.col);
      const maxC = Math.max(range.start.col, range.end.col);
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (newData[r]?.[c] !== undefined) {
            newData[r][c] = transformer(newData[r][c]);
          }
        }
      }
    });
    this.data.set(newData);
    this.message.success('Transform applied');
  }

  openNumberTransform(): void {
    const ref = this.modal.create({
      nzTitle: 'Reformat Numbers',
      nzContent: TransformNumberComponent,
      nzOkText: 'Apply',
      nzOnOk: (instance: TransformNumberComponent) => {
        const { transformer } = instance.getResult();
        this.applyTransformToSelection(transformer);
      },
    });
    const instance = ref.getContentComponent();
    instance?.setInputValues(this.getSelectedValues());
  }

  openDateTransform(): void {
    const ref = this.modal.create({
      nzTitle: 'Reformat Dates',
      nzContent: TransformDateComponent,
      nzOkText: 'Apply',
      nzOnOk: (instance: TransformDateComponent) => {
        this.applyTransformToSelection(instance.getTransformer());
      },
    });
    const instance = ref.getContentComponent();
    instance?.setInputValues(this.getSelectedValues());
  }

  openMarkupTransform(): void {
    const ref = this.modal.create({
      nzTitle: 'HTML ↔ Markdown Conversion',
      nzContent: TransformMarkupComponent,
      nzOkText: 'Apply',
      nzOnOk: (instance: TransformMarkupComponent) => {
        this.applyTransformToSelection(instance.getTransformer());
      },
    });
    const instance = ref.getContentComponent();
    instance?.setInputValues(this.getSelectedValues());
  }

  openFormula(): void {
    const data = this.hasHeader() ? this.data().slice(1) : this.data();
    const headers =
      this.hasHeader() && this.data().length > 0
        ? this.data()[0]
        : (this.data()[0] || []).map((_, i) => String.fromCharCode(65 + i));

    const ref = this.modal.create({
      nzTitle: 'Column Formula',
      nzContent: FormulaBarComponent,
      nzOkText: 'Apply',
      nzOnOk: (instance: FormulaBarComponent) => {
        const { targetCol, transformer } = instance.getResult();
        const newData = this.data().map((row, ri) => {
          if (this.hasHeader() && ri === 0) return row;
          const newRow = [...row];
          newRow[targetCol] = transformer(row);
          return newRow;
        });
        this.historyService.push(this.data());
        this.data.set(newData);
        this.message.success('Formula applied');
      },
    });
    const instance = ref.getContentComponent();
    instance?.setData(data, headers);
  }

  toggleDarkMode(val: boolean): void {
    this.isDarkMode.set(val);
    if (val) {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }
}
