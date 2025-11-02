export {};

declare global {
  interface Window {
    app: {
      ping: (message: string) => Promise<{ ok: boolean; timestamp: number }>;
    };
  }
}
