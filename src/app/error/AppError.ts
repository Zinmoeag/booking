import { ErrorBase, errorKinds, errorKindsType, Payload } from './error.base';

export class AppError extends ErrorBase {
  constructor(
    error: errorKindsType,
    message: string,
    payload?: Payload,
    service?: string
  ) {
    super(error, message, payload, service);
  }

  static new(
    error: errorKindsType = errorKinds.internalServerError,
    message = 'internal Server Error',
    payload?: Payload,
    service?: string
  ) {
    return new AppError(error, message, payload, service);
  }
}
