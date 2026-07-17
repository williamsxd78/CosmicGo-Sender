import type { CosmicApi } from '../../preload/index';

declare global {
  interface Window {
    cosmic: CosmicApi;
  }
}
export {};
