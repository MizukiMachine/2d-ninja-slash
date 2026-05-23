interface TestPngBuffer {
  subarray(start: number, end: number): {
    toString(encoding: 'ascii'): string;
  };
  readUInt32BE(offset: number): number;
}

declare module 'node:fs' {
  export function readFileSync(path: URL): TestPngBuffer;
}
