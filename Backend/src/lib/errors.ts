export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "BAD_REQUEST") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentError";
  }
}
