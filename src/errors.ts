export class NerdGraphError extends Error {
  constructor(
    message: string,
    public readonly gqlErrors?: unknown[]
  ) {
    super(message);
    this.name = 'NerdGraphError';
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
