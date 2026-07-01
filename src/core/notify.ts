import {
  isPermissionGranted,
  requestPermission,
  sendNotification as tauriNotify,
} from "@tauri-apps/plugin-notification";

export class Notifier {
  private _granted: boolean | null = null;
  private _initPromise: Promise<void> | null = null;

  async ensurePermission(): Promise<void> {
    if (this._granted !== null) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      this._granted = await isPermissionGranted();
      if (!this._granted) {
        const permission = await requestPermission();
        this._granted = permission === "granted";
      }
    })();

    return this._initPromise;
  }

  async notify(title: string, body: string): Promise<void> {
    await this.ensurePermission();
    if (this._granted) {
      tauriNotify({ title, body });
    }
  }
}

export const notifier = new Notifier();
export const notify = (title: string, body: string): Promise<void> => notifier.notify(title, body);
