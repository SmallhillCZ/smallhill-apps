import {
  Component,
  inject,
  signal,
  ViewChild,
  ElementRef,
  HostListener,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzDropDownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { CellRange, CellPosition } from '../../models/cell.model';
import { SelectionState } from '../../models/selection.model';
import { T } from '../../i18n';

@Component({
  selector: 'app-grid',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ScrollingModule,
    NzTooltipModule,
    NzDropDownModule,
    NzIconModule,
    NzButtonModule,
    NzInputModule,
  ],
  templateUrl: './grid.component.html',
  styleUrl: './grid.component.scss',
})
export class GridComponent {
  protected readonly t = T;
  data = input<string[][]>([]);
  hasHeader = input<boolean>(true);

  dataChange = output<string[][]>();
  selectionChange = output<SelectionState>();
  fileDrop = output<File>();

  readonly editingCell = signal<CellPosition | null>(null);
  readonly editValue = signal('');
  readonly selection = signal<SelectionState>({ activeCell: null, ranges: [] });
  readonly columnWidths = signal<number[]>([]);
  readonly sortConfig = signal<{ col: number; dir: 'asc' | 'desc' } | null>(null);
  readonly filterValues = signal<Map<number, string>>(new Map());
  readonly isDragOver = signal(false);
  readonly isSelecting = signal(false);
  readonly fillDragging = signal(false);
  readonly fillStart = signal<CellPosition | null>(null);

  private resizingCol: number | null = null;
  private resizeStartX = 0;
  private resizeStartWidth = 0;

  @ViewChild(CdkVirtualScrollViewport) viewport!: CdkVirtualScrollViewport;
  @ViewChild('editInput') editInput!: ElementRef<HTMLInputElement>;

  get rows(): string[][] {
    return this.hasHeader() ? this.data().slice(1) : this.data();
  }

  get headers(): string[] {
    if (this.hasHeader() && this.data().length > 0) {
      return this.data()[0];
    }
    return (this.data()[0] || []).map((_, i) => this.colLabel(i));
  }

  colLabel(i: number): string {
    let label = '';
    let n = i;
    do {
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return label;
  }

  filteredRows(): { row: string[]; originalIndex: number }[] {
    const rows = this.rows;
    const filterMap = this.filterValues();
    const sortCfg = this.sortConfig();

    let indexed = rows.map((row, i) => ({ row, originalIndex: i + (this.hasHeader() ? 1 : 0) }));

    filterMap.forEach((filterVal, col) => {
      if (filterVal) {
        indexed = indexed.filter(({ row }) =>
          (row[col] || '').toLowerCase().includes(filterVal.toLowerCase()),
        );
      }
    });

    if (sortCfg) {
      indexed.sort((a, b) => {
        const av = a.row[sortCfg.col] || '';
        const bv = b.row[sortCfg.col] || '';
        const cmp = av.localeCompare(bv, undefined, { numeric: true });
        return sortCfg.dir === 'asc' ? cmp : -cmp;
      });
    }

    return indexed;
  }

  trackByIndex(_index: number, item: { row: string[]; originalIndex: number }): number {
    return item.originalIndex;
  }

  isCellSelected(rowIdx: number, colIdx: number): boolean {
    const sel = this.selection();
    return sel.ranges.some((range) => {
      const minR = Math.min(range.start.row, range.end.row);
      const maxR = Math.max(range.start.row, range.end.row);
      const minC = Math.min(range.start.col, range.end.col);
      const maxC = Math.max(range.start.col, range.end.col);
      return rowIdx >= minR && rowIdx <= maxR && colIdx >= minC && colIdx <= maxC;
    });
  }

  isActiveCell(rowIdx: number, colIdx: number): boolean {
    const active = this.selection().activeCell;
    return active?.row === rowIdx && active?.col === colIdx;
  }

  onCellMouseDown(event: MouseEvent, rowIdx: number, colIdx: number): void {
    if (event.button !== 0) return;
    this.isSelecting.set(true);

    const sel = this.selection();
    if (event.ctrlKey || event.metaKey) {
      this.selection.set({
        activeCell: { row: rowIdx, col: colIdx },
        ranges: [
          ...sel.ranges,
          { start: { row: rowIdx, col: colIdx }, end: { row: rowIdx, col: colIdx } },
        ],
      });
    } else if (event.shiftKey && sel.activeCell) {
      const ranges = [...sel.ranges];
      if (ranges.length > 0) {
        ranges[ranges.length - 1] = { start: sel.activeCell, end: { row: rowIdx, col: colIdx } };
      }
      this.selection.set({ activeCell: sel.activeCell, ranges });
    } else {
      this.selection.set({
        activeCell: { row: rowIdx, col: colIdx },
        ranges: [{ start: { row: rowIdx, col: colIdx }, end: { row: rowIdx, col: colIdx } }],
      });
    }
    this.selectionChange.emit(this.selection());
  }

  onCellMouseMove(rowIdx: number, colIdx: number): void {
    if (!this.isSelecting()) return;
    const sel = this.selection();
    if (sel.ranges.length > 0 && sel.activeCell) {
      const ranges = [...sel.ranges];
      ranges[ranges.length - 1] = { start: sel.activeCell, end: { row: rowIdx, col: colIdx } };
      this.selection.set({ ...sel, ranges });
    }
  }

  @HostListener('mouseup')
  onMouseUp(): void {
    this.isSelecting.set(false);
    this.fillDragging.set(false);
    this.resizingCol = null;
  }

  onCellDblClick(rowIdx: number, colIdx: number): void {
    this.startEditing(rowIdx, colIdx);
  }

  startEditing(rowIdx: number, colIdx: number): void {
    const row = this.data()[rowIdx];
    if (!row) return;
    this.editingCell.set({ row: rowIdx, col: colIdx });
    this.editValue.set(row[colIdx] || '');
    setTimeout(() => this.editInput?.nativeElement?.focus(), 0);
  }

  commitEdit(): void {
    const editing = this.editingCell();
    if (!editing) return;
    const newData = this.data().map((row) => [...row]);
    if (newData[editing.row]) {
      newData[editing.row][editing.col] = this.editValue();
    }
    this.dataChange.emit(newData);
    this.editingCell.set(null);
  }

  cancelEdit(): void {
    this.editingCell.set(null);
  }

  onEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const editing = this.editingCell();
      this.commitEdit();
      if (editing) {
        const nextRow = editing.row + 1;
        if (nextRow < this.data().length) {
          this.startEditing(nextRow, editing.col);
        }
      }
    } else if (event.key === 'Escape') {
      this.cancelEdit();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const editing = this.editingCell();
      this.commitEdit();
      if (editing) {
        const nextCol = editing.col + (event.shiftKey ? -1 : 1);
        const cols = (this.data()[editing.row] || []).length;
        if (nextCol >= 0 && nextCol < cols) {
          this.startEditing(editing.row, nextCol);
        }
      }
    }
  }

  @HostListener('keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (this.editingCell()) return;
    const sel = this.selection();
    const active = sel.activeCell;
    if (!active) return;

    const rows = this.data();
    const cols = rows[0]?.length || 0;

    if (event.key === 'ArrowUp' && active.row > 0) {
      event.preventDefault();
      this.moveTo(active.row - 1, active.col, event.shiftKey);
    } else if (event.key === 'ArrowDown' && active.row < rows.length - 1) {
      event.preventDefault();
      this.moveTo(active.row + 1, active.col, event.shiftKey);
    } else if (event.key === 'ArrowLeft' && active.col > 0) {
      event.preventDefault();
      this.moveTo(active.row, active.col - 1, event.shiftKey);
    } else if (event.key === 'ArrowRight' && active.col < cols - 1) {
      event.preventDefault();
      this.moveTo(active.row, active.col + 1, event.shiftKey);
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const nextCol = active.col + (event.shiftKey ? -1 : 1);
      if (nextCol >= 0 && nextCol < cols) {
        this.moveTo(active.row, nextCol, false);
      }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.startEditing(active.row, active.col);
    } else if (event.key === 'F2') {
      event.preventDefault();
      this.startEditing(active.row, active.col);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      this.clearSelection();
    } else if (event.key === 'c' && (event.ctrlKey || event.metaKey)) {
      this.copySelection();
    } else if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
      this.editingCell.set(active);
      this.editValue.set(event.key);
      setTimeout(() => this.editInput?.nativeElement?.focus(), 0);
    }
  }

  moveTo(row: number, col: number, extend: boolean): void {
    const sel = this.selection();
    if (extend && sel.activeCell) {
      const ranges = [...sel.ranges];
      if (ranges.length > 0) {
        ranges[ranges.length - 1] = { start: sel.activeCell, end: { row, col } };
      } else {
        ranges.push({ start: sel.activeCell, end: { row, col } });
      }
      this.selection.set({ ...sel, ranges });
    } else {
      this.selection.set({
        activeCell: { row, col },
        ranges: [{ start: { row, col }, end: { row, col } }],
      });
    }
    this.selectionChange.emit(this.selection());
  }

  clearSelection(): void {
    const sel = this.selection();
    const newData = this.data().map((row) => [...row]);
    sel.ranges.forEach((range) => {
      const minR = Math.min(range.start.row, range.end.row);
      const maxR = Math.max(range.start.row, range.end.row);
      const minC = Math.min(range.start.col, range.end.col);
      const maxC = Math.max(range.start.col, range.end.col);
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (newData[r]) newData[r][c] = '';
        }
      }
    });
    this.dataChange.emit(newData);
  }

  copySelection(): void {
    const sel = this.selection();
    if (sel.ranges.length === 0) return;
    const range = sel.ranges[0];
    const minR = Math.min(range.start.row, range.end.row);
    const maxR = Math.max(range.start.row, range.end.row);
    const minC = Math.min(range.start.col, range.end.col);
    const maxC = Math.max(range.start.col, range.end.col);
    const text = this.data()
      .slice(minR, maxR + 1)
      .map((row) => row.slice(minC, maxC + 1).join('\t'))
      .join('\n');
    navigator.clipboard.writeText(text);
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    if (this.editingCell()) return;
    const text = event.clipboardData?.getData('text') || '';
    if (!text) return;
    event.preventDefault();

    const pasteRows = text.split('\n').map((line) => line.split('\t'));
    const active = this.selection().activeCell;
    if (!active) return;

    const newData = this.data().map((row) => [...row]);
    pasteRows.forEach((pasteRow, ri) => {
      pasteRow.forEach((cell, ci) => {
        const tr = active.row + ri;
        const tc = active.col + ci;
        if (tr < newData.length && tc < (newData[tr]?.length || 0)) {
          newData[tr][tc] = cell;
        }
      });
    });
    this.dataChange.emit(newData);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDragLeave(): void {
    this.isDragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.fileDrop.emit(file);
  }

  onFillHandleMouseDown(event: MouseEvent): void {
    event.stopPropagation();
    this.fillDragging.set(true);
    this.fillStart.set(this.selection().activeCell);
  }

  getSelectedRange(): CellRange | null {
    const ranges = this.selection().ranges;
    return ranges.length > 0 ? ranges[0] : null;
  }

  toggleSort(col: number): void {
    const current = this.sortConfig();
    if (current?.col === col) {
      if (current.dir === 'asc') {
        this.sortConfig.set({ col, dir: 'desc' });
      } else {
        this.sortConfig.set(null);
      }
    } else {
      this.sortConfig.set({ col, dir: 'asc' });
    }
  }

  setFilter(col: number, value: string): void {
    const map = new Map(this.filterValues());
    if (value) {
      map.set(col, value);
    } else {
      map.delete(col);
    }
    this.filterValues.set(map);
  }

  onResizeStart(event: MouseEvent, colIdx: number): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizingCol = colIdx;
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.getColumnWidth(colIdx);

    const onMove = (e: MouseEvent) => {
      if (this.resizingCol === null) return;
      const delta = e.clientX - this.resizeStartX;
      const widths = [...this.columnWidths()];
      while (widths.length <= this.resizingCol) widths.push(120);
      widths[this.resizingCol] = Math.max(50, this.resizeStartWidth + delta);
      this.columnWidths.set(widths);
    };

    const onUp = () => {
      this.resizingCol = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  resizeColumn(colIdx: number, delta: number): void {
    const widths = [...this.columnWidths()];
    while (widths.length <= colIdx) widths.push(120);
    widths[colIdx] = Math.max(50, (widths[colIdx] || 120) + delta);
    this.columnWidths.set(widths);
  }

  getColumnWidth(colIdx: number): number {
    return this.columnWidths()[colIdx] || 120;
  }

  getFilterValue(col: number): string {
    return this.filterValues().get(col) || '';
  }

  selectRow(rowIdx: number): void {
    const cols = (this.data()[rowIdx] || []).length;
    if (cols === 0) return;
    this.selection.set({
      activeCell: { row: rowIdx, col: 0 },
      ranges: [{ start: { row: rowIdx, col: 0 }, end: { row: rowIdx, col: cols - 1 } }],
    });
    this.selectionChange.emit(this.selection());
  }

  addRow(): void {
    const cols = this.data()[0]?.length || 0;
    const newRow = Array(cols).fill('');
    this.dataChange.emit([...this.data(), newRow]);
  }

  addColumn(): void {
    const newData = this.data().map((row) => [...row, '']);
    this.dataChange.emit(newData);
  }

  deleteRow(rowIdx: number): void {
    const newData = [...this.data()];
    newData.splice(rowIdx, 1);
    this.dataChange.emit(newData);
  }

  deleteColumn(colIdx: number): void {
    const newData = this.data().map((row) => {
      const newRow = [...row];
      newRow.splice(colIdx, 1);
      return newRow;
    });
    this.dataChange.emit(newData);
  }

  showFillHandle(): boolean {
    const sel = this.selection();
    return sel.ranges.length === 1;
  }

  isFillHandleCell(rowIdx: number, colIdx: number): boolean {
    const range = this.getSelectedRange();
    if (!range) return false;
    const maxR = Math.max(range.start.row, range.end.row);
    const maxC = Math.max(range.start.col, range.end.col);
    return rowIdx === maxR && colIdx === maxC;
  }
}
