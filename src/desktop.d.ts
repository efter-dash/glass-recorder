interface Window {
  glassRecorder?: {
    checkUpdate(): Promise<{ available: boolean; version: string }>;
    openUpdate(): Promise<void>;
    save(data: ArrayBuffer, name: string): Promise<boolean>;
  };
}
