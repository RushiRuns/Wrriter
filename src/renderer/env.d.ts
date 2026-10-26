/// <reference types="vite/client" />

declare global {
  interface Window {
    readonly wrriter?: import('../../shared/ipc').WrriterApi;
  }
}

export {};
