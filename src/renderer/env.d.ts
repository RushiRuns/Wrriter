declare global {
  interface Window {
    readonly wrriter?: import('../../preload/index').WrriterApi
  }
}


export {}

