/* eslint-disable @typescript-eslint/no-empty-function */
import { loggingEngine } from './logger.base';

interface HttpLoggerContext {
  service: string;
}

export class HttpLogger extends loggingEngine {
  private static service: string;

  constructor({ service }: HttpLoggerContext) {
    // set context as local static variable
    HttpLogger.service = service;
    super();
  }

  customeLog = (
    method: string,
    path: string,
    statusCode: number,
    message: string,
    meta?: any
  ) => {
    this.log(
      'info',
      'User did smth',
      `${method} ${path} : ${statusCode} ${message}`,
      meta
    );
  };

  protected setDefaultMeta(): void {
    this.defaultMeta = {
      service: HttpLogger.service,
    };
  }

  protected setLoggerOutputPath(): void {}

  protected setModule(): void {
    this.module = 'HTTP_LOGGER';
  }
}
