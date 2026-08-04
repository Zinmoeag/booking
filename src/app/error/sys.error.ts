import { ErrorBase, errorKinds, errorKindsType, Payload } from './error.base';

export class SysError extends ErrorBase {
  constructor(
    errorKind: errorKindsType,
    message: string,
    payload?: Payload,
    service?: string
  ) {
    super(errorKind, message, payload, service);
  }

  static new(
    error: errorKindsType = errorKinds.internalServerError,
    message = 'internal Server Error',
    payload?: Payload,
    service?: string
  ) {
    if (payload !== undefined && service !== undefined) {
      return new SysError(error, message, payload, service);
    } else if (payload !== undefined) {
      return new SysError(error, message, payload);
    } else if (service !== undefined) {
      return new SysError(error, message, undefined, service);
    } else {
      return new SysError(error, message);
    }
  }
}
