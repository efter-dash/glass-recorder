interface Window {
  glassRecorder?: { save(data: ArrayBuffer, name: string): Promise<boolean> };
}
