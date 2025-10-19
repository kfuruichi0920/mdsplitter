declare module 'iconv-lite/encodings' {
  import type iconvModule from 'iconv-lite';
  const load: (iconv: typeof iconvModule) => void;
  export = load;
}
