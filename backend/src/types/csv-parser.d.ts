declare module 'csv-parser' {
  import { Transform } from 'stream';
  interface Options {
    separator?: string;
    newline?: string;
    quote?: string;
    escape?: string;
    headers?: string[] | boolean;
    skipLines?: number;
    strict?: boolean;
    mapHeaders?(args: { header: string; index: number }): string;
    mapValues?(args: { header: string; index: number; value: any }): any;
  }
  export default function csvParser(options?: Options): Transform;
}
