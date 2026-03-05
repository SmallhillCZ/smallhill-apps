import { CellRange } from './cell.model';

export interface SelectionState {
  activeCell: { row: number; col: number } | null;
  ranges: CellRange[];
}
