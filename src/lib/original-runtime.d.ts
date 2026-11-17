export function mountOriginal(options: any): {
  syncPath: (path: string) => void;
  attach: (el: HTMLElement, path: string) => void;
  destroy: () => void;
};
