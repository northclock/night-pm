import { globalShortcut } from 'electron';
import { toggleThoughtsWindow } from './windows';

export function registerShortcuts() {
  globalShortcut.register('Shift+CommandOrControl+Y', () => {
    toggleThoughtsWindow();
  });
}

export function unregisterShortcuts() {
  globalShortcut.unregisterAll();
}
