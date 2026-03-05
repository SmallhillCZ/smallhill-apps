import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HistoryService<T> {
  private history: T[] = [];
  private currentIndex = -1;

  readonly canUndo = signal(false);
  readonly canRedo = signal(false);

  push(state: T): void {
    this.history = this.history.slice(0, this.currentIndex + 1);
    this.history.push(structuredClone(state));
    this.currentIndex = this.history.length - 1;
    this.updateSignals();
  }

  undo(): T | null {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateSignals();
      return structuredClone(this.history[this.currentIndex]);
    }
    return null;
  }

  redo(): T | null {
    if (this.currentIndex < this.history.length - 1) {
      this.currentIndex++;
      this.updateSignals();
      return structuredClone(this.history[this.currentIndex]);
    }
    return null;
  }

  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.updateSignals();
  }

  private updateSignals(): void {
    this.canUndo.set(this.currentIndex > 0);
    this.canRedo.set(this.currentIndex < this.history.length - 1);
  }
}
