export class SlyxUpError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'SlyxUpError';
  }
}

export class RegistryError extends SlyxUpError {
  constructor(message: string, details?: unknown) {
    super(message, 'REGISTRY_ERROR', details);
    this.name = 'RegistryError';
  }
}

export class ValidationError extends SlyxUpError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class IntegrityError extends SlyxUpError {
  constructor(message: string, details?: unknown) {
    super(message, 'INTEGRITY_ERROR', details);
    this.name = 'IntegrityError';
  }
}

export class FileSystemError extends SlyxUpError {
  constructor(message: string, details?: unknown) {
    super(message, 'FILESYSTEM_ERROR', details);
    this.name = 'FileSystemError';
  }
}

export class InstallationError extends SlyxUpError {
  constructor(message: string, details?: unknown) {
    super(message, 'INSTALLATION_ERROR', details);
    this.name = 'InstallationError';
  }
}

export class RollbackError extends SlyxUpError {
  constructor(message: string, details?: unknown) {
    super(message, 'ROLLBACK_ERROR', details);
    this.name = 'RollbackError';
  }
}
