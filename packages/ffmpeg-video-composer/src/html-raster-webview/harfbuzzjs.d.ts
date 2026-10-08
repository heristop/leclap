// The two CommonJS files of harfbuzzjs the page's shim imports (the package ships no types).

declare module 'harfbuzzjs/hb.js' {
  const createHarfBuzz: (module: { wasmBinary: Uint8Array }) => Promise<unknown>;
  export default createHarfBuzz;
}

declare module 'harfbuzzjs/hbjs.js' {
  const hbjs: (instance: unknown) => unknown;
  export default hbjs;
}
