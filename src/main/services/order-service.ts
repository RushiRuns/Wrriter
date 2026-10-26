import * as fs from 'fs';
import * as path from 'path';
import { SafeWriter } from './safe-writer';
import { Result, ok, err } from '../../shared/result';

export interface VaultOrderFile {
  version: number;
  folders: Record<string, Record<string, string>>; // folderRelPath -> (noteRelPath -> fractionalKey)
}

export interface VaultPinsFile {
  version: number;
  pins: string[]; // array of relative note paths
}

export class OrderService {
  private readonly safeWriter: SafeWriter;

  constructor(safeWriter: SafeWriter = new SafeWriter()) {
    this.safeWriter = safeWriter;
  }

  private getWrriterDir(vaultRoot: string): string {
    return path.join(vaultRoot, '.wrriter');
  }

  // --- Pins ---
  async getPins(vaultRoot: string): Promise<string[]> {
    const file = path.join(this.getWrriterDir(vaultRoot), 'pins.json');
    try {
      if (!fs.existsSync(file)) return [];
      const content = await fs.promises.readFile(file, 'utf8');
      const data: VaultPinsFile = JSON.parse(content);
      return data.pins ?? [];
    } catch {
      return [];
    }
  }

  async setPin(vaultRoot: string, notePath: string, pinned: boolean): Promise<Result<string[]>> {
    const pins = await this.getPins(vaultRoot);
    const normalized = notePath.replace(/\\/g, '/');
    const existingIndex = pins.indexOf(normalized);

    if (pinned && existingIndex === -1) {
      pins.push(normalized);
    } else if (!pinned && existingIndex !== -1) {
      pins.splice(existingIndex, 1);
    }

    const wrriterDir = this.getWrriterDir(vaultRoot);
    await fs.promises.mkdir(wrriterDir, { recursive: true });

    const payload: VaultPinsFile = {
      version: 1,
      pins
    };

    const res = await this.safeWriter.write(wrriterDir, 'pins.json', JSON.stringify(payload, null, 2));
    if (!res.ok) return res;
    return ok(pins);
  }

  // --- Order ---
  async getOrderFile(vaultRoot: string): Promise<VaultOrderFile> {
    const file = path.join(this.getWrriterDir(vaultRoot), 'order.json');
    try {
      if (!fs.existsSync(file)) return { version: 1, folders: {} };
      const content = await fs.promises.readFile(file, 'utf8');
      return JSON.parse(content);
    } catch {
      return { version: 1, folders: {} };
    }
  }

  async getFolderOrder(vaultRoot: string, folderRelPath: string): Promise<Record<string, string>> {
    const data = await this.getOrderFile(vaultRoot);
    const normalizedFolder = folderRelPath.replace(/\\/g, '/');
    return data.folders[normalizedFolder] ?? {};
  }

  async setOrderKey(
    vaultRoot: string,
    folderRelPath: string,
    notePath: string,
    key: string
  ): Promise<Result<void>> {
    const data = await this.getOrderFile(vaultRoot);
    const normalizedFolder = folderRelPath.replace(/\\/g, '/');
    const normalizedNote = notePath.replace(/\\/g, '/');

    if (!data.folders[normalizedFolder]) {
      data.folders[normalizedFolder] = {};
    }

    data.folders[normalizedFolder]![normalizedNote] = key;

    const wrriterDir = this.getWrriterDir(vaultRoot);
    await fs.promises.mkdir(wrriterDir, { recursive: true });

    const res = await this.safeWriter.write(wrriterDir, 'order.json', JSON.stringify(data, null, 2));
    if (!res.ok) return res;
    return ok(undefined);
  }
}
