import { Component, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { lang, LANGS, setLang, T } from '../../i18n';
import { Theme, THEMES } from '../../theme';

@Component({
  selector: 'app-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzIconModule,
    NzSelectModule,
    NzSwitchModule,
    NzTooltipModule,
    NzDividerModule,
  ],
  templateUrl: './toolbar.component.html',
  styleUrl: './toolbar.component.scss',
})
export class ToolbarComponent {
  canUndo = input<boolean>(false);
  canRedo = input<boolean>(false);
  hasHeader = input<boolean>(true);
  delimiter = input<string>(',');
  filename = input<string>('');
  hasData = input<boolean>(false);
  theme = input<Theme>('auto');

  openFile = output<void>();
  saveFile = output<string>();
  undo = output<void>();
  redo = output<void>();
  hasHeaderChange = output<boolean>();
  delimiterChange = output<string>();
  themeChange = output<Theme>();
  transformNumber = output<void>();
  transformDate = output<void>();
  transformMarkup = output<void>();
  showFormula = output<void>();

  protected readonly t = T;
  protected readonly lang = lang;
  protected readonly langs = LANGS;
  protected readonly setLang = setLang;
  protected readonly themes = THEMES;

  delimiterOptions = computed(() => [
    { value: ',', label: T().comma },
    { value: ';', label: T().semicolon },
    { value: '\t', label: T().tab },
    { value: '|', label: T().pipe },
  ]);

  onOpenFile(): void {
    this.openFile.emit();
  }
  onSaveFile(): void {
    this.saveFile.emit(this.delimiter());
  }
  onUndo(): void {
    this.undo.emit();
  }
  onRedo(): void {
    this.redo.emit();
  }
  onHasHeaderChange(val: boolean): void {
    this.hasHeaderChange.emit(val);
  }
  onDelimiterChange(val: string): void {
    this.delimiterChange.emit(val);
  }
  onThemeChange(val: Theme): void {
    this.themeChange.emit(val);
  }
}
