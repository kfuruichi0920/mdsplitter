import { formatLogLevel, isLogLevelEnabled, toBytes } from './logging';

describe('logging utilities', () => {
  it('determines enabled log levels', () => {
    expect(isLogLevelEnabled('error', 'info')).toBe(true);
    expect(isLogLevelEnabled('warn', 'info')).toBe(true);
    expect(isLogLevelEnabled('debug', 'info')).toBe(false);
  });

  it('formats levels to uppercase', () => {
    expect(formatLogLevel('warn')).toBe('WARN');
  });

  it('converts megabytes to bytes', () => {
    expect(toBytes(0.5)).toBe(524288);
    expect(toBytes(0)).toBe(1);
  });
});
