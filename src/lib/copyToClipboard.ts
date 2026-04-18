/** Copy text; uses Electron IPC when available for reliability in packaged apps. */
export async function copyToClipboard(text: string): Promise<void> {
  if (window.electronAPI?.writeClipboard) {
    await window.electronAPI.writeClipboard(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}
