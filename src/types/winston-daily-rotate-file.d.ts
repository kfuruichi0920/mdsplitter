declare module 'winston-daily-rotate-file' {
  import { TransportStreamOptions } from 'winston-transport';
  import TransportStream from 'winston-transport';

  interface DailyRotateFileTransportOptions extends TransportStreamOptions {
    filename?: string;
    dirname?: string;
    datePattern?: string;
    zippedArchive?: boolean;
    frequency?: string;
    maxSize?: string | number;
    maxFiles?: string | number;
    auditFile?: string;
    utc?: boolean;
    extension?: string;
  }

  class DailyRotateFile extends TransportStream {
    constructor(options?: DailyRotateFileTransportOptions);
  }

  export = DailyRotateFile;
}
