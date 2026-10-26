import { shell } from 'electron';
import * as fs from 'fs';
import { Result, ok, err } from '../../shared/result';

/**
 * Platform adapter sending files/folders to the native Windows Recycle Bin.
 * Hard rule: Every user deletion goes to the Recycle Bin (never permanent unlink).
 */
export async function sendToRecycleBin(fullPath: string): Promise<Result<void>> {
  try {
    if (!fs.existsSync(fullPath)) {
      return err({ kind: 'notFound' });
    }

    await shell.trashItem(fullPath);
    return ok(undefined);
  } catch (error: any) {
    console.error(`Failed to move ${fullPath} to Recycle Bin:`, error);
    return err({
      kind: 'unexpected',
      message: error?.message ?? 'Failed to move file to Recycle Bin'
    });
  }
}
