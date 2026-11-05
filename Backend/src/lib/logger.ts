export const log = {
  info(message: string, extra?: Record<string, unknown>) {
    console.log(JSON.stringify({ level: "info", message, ...extra }));
  },
  error(message: string, extra?: Record<string, unknown>) {
    console.error(JSON.stringify({ level: "error", message, ...extra }));
  }
};
