/* eslint-disable no-unused-vars */
export class HttpDetailResponse<T> {
  constructor(
    public result: T,
    public status: number,
    public meta?: Record<string, any>
  ) {}

  static json<T>({
    message,
    meta,
    result,
    status,
  }: {
    message: string;
    meta?: Record<string, any>;
    result: T;
    status: number;
  }) {
    return new HttpDetailResponse<T>(result, status, { message, ...meta });
  }
}

export class HttpGenericResponse {
  constructor(
    public message: string,
    public status: number,
    public error?: number | Record<string, any> | string
  ) {}

  static json({
    error,
    message,
    status,
  }: {
    error?: number | Record<string, any> | string;
    message: string;
    status: number;
  }) {
    return new HttpGenericResponse(message, status, error);
  }
}

export class HttpListResponse<T> {
  constructor(
    public count: number,
    public result: T[],
    public status: number,
    public meta?: Record<string, any>
  ) {}

  static json<T>({
    count,
    meta,
    result,
    status,
  }: {
    count: number;
    meta?: Record<string, any>;
    result: T[];
    status: number;
  }) {
    return new HttpListResponse<T>(count, result, status, meta);
  }
}
