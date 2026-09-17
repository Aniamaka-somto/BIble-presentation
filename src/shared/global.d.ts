import type { ScriptureCasterApi } from "./types";

declare global {
  interface Window {
    scriptureCaster: ScriptureCasterApi;
  }
}

export {};