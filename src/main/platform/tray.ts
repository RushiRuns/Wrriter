import { Tray, Menu, nativeImage, type NativeImage } from 'electron';

export interface TrayHandlers {
  onOpenMainWindow: () => void;
  onNewQuickNote: () => void;
  onQuit: () => void;
}

export interface TrayAdapter {
  createTray(handlers: TrayHandlers): void;
  destroyTray(): void;
  isCreated(): boolean;
  setToolTip(tooltip: string): void;
}

/**
 * Generates a clean 16x16 high-contrast monochrome tray icon for Windows taskbar.
 * 16x16 RGBA PNG base64 encoding.
 */
function createDefaultTrayIcon(): NativeImage {
  // 16x16 PNG representing Wrriter's minimalist note icon
  const iconBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAA' +
    'EnQAABJ0Ad5mPtUAAAAhdEVYdENyZWF0aW9uIFRpbWUAMjAyNi0xMC0yOCAxNDo0MDowMMn01QcAAAEPSURBVDhPY2AYBfQG' +
    'jIyM/0EYm2YmBgYGCwaGf3B+FCPDTxDNwMAwDYihakFqmBgZ/jExMv4DYpD5MGA0A4QZGf4yMDD8AmFkJjZ5qBkMDAwMjAwM' +
    'm/4zMv5F1wAxiZkJ7iomho9/GRj+Q7kMDL9RNKAYkM7I8BtkmQkDIwM/IwPDfzTNUAyUYGBg+M/EwLAbxGNg+Ae16x/EgTDD' +
    'f1jWgyxA04wMMFwL9gYjwwcgZvgPAyB3IjMwAFl/GRl+A/Hvv4wMv/6ia8AmBqIeYGRkgFmOzcAMkM8h09Dk/4PMB5mOzYBM' +
    'kFpGBgY4gIWPf0DqGBj+/UdXgKwB0qxg+AekGWZANiPjHzRNKMZgYAAAhz7i1e6v22EAAAAASUVORK5CYII=';

  const image = nativeImage.createFromDataURL(`data:image/png;base64,${iconBase64}`);
  return image;
}

/**
 * Platform adapter managing the Windows Notification Area (System Tray) icon and menu.
 * ARCHITECTURE.md: "Tray icon: Menu: New quick note, Open Wrriter, Quit, and a click on the icon
 * opens the main window. Keep running in the background is on by default, with no question on first launch."
 */
export class ElectronTrayAdapter implements TrayAdapter {
  private tray: Tray | null = null;

  createTray(handlers: TrayHandlers): void {
    if (this.tray && !this.tray.isDestroyed()) {
      return;
    }

    const icon = createDefaultTrayIcon();
    this.tray = new Tray(icon);
    this.tray.setToolTip('Wrriter');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'New quick note',
        click: () => handlers.onNewQuickNote()
      },
      {
        label: 'Open Wrriter',
        click: () => handlers.onOpenMainWindow()
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => handlers.onQuit()
      }
    ]);

    this.tray.setContextMenu(contextMenu);

    // Left-click directly restores/opens the main window
    this.tray.on('click', () => {
      handlers.onOpenMainWindow();
    });

    this.tray.on('double-click', () => {
      handlers.onOpenMainWindow();
    });
  }

  destroyTray(): void {
    if (this.tray && !this.tray.isDestroyed()) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  isCreated(): boolean {
    return this.tray !== null && !this.tray.isDestroyed();
  }

  setToolTip(tooltip: string): void {
    if (this.tray && !this.tray.isDestroyed()) {
      this.tray.setToolTip(tooltip);
    }
  }
}
