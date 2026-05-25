interface TestPngBuffer {
  subarray(start: number, end: number): {
    toString(encoding: 'ascii'): string;
  };
  readUInt32BE(offset: number): number;
}

declare module 'node:fs' {
  export function readFileSync(path: URL): TestPngBuffer;
  export function readdirSync(path: string | URL): string[];
  export function statSync(path: string): {
    isFile(): boolean;
  };
}

declare module 'node:path' {
  export const sep: string;
  export function join(...paths: string[]): string;
  export function resolve(...paths: string[]): string;
}

declare const process: {
  cwd(): string;
};
