import type { WrriterApi } from './index'

declare global {
  interface Window {
    readonly wrriter: WrriterApi
  }
}
