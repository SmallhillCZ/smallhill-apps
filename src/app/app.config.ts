import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {
  FolderOpenOutline, SaveOutline, UndoOutline, RedoOutline, SettingOutline,
  SortAscendingOutline, SortDescendingOutline, FilterOutline, NumberOutline,
  CalendarOutline, CodeOutline, FunctionOutline, PlusOutline, DeleteOutline,
  MenuOutline, MoonOutline, SunOutline
} from '@ant-design/icons-angular/icons';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideNzI18n(en_US),
    provideNzIcons([
      FolderOpenOutline, SaveOutline, UndoOutline, RedoOutline, SettingOutline,
      SortAscendingOutline, SortDescendingOutline, FilterOutline, NumberOutline,
      CalendarOutline, CodeOutline, FunctionOutline, PlusOutline, DeleteOutline,
      MenuOutline, MoonOutline, SunOutline
    ]),
    provideAnimationsAsync(),
  ]
};
