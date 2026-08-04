/* eslint-disable @typescript-eslint/no-empty-function */
import { loggingEngine } from './logger.base';

interface SysLoggerContext {
  service: string;
}

export class SysLogger extends loggingEngine {
  private static service: string;

  constructor({ service }: SysLoggerContext) {
    // set context as local static variable
    SysLogger.service = service;
    super();
  }

  protected setDefaultMeta(): void {
    this.defaultMeta = {
      service: SysLogger.service,
    };
  }

  protected setLoggerOutputPath(): void {}

  protected setModule(): void {
    this.module = 'SYS_LOGGER';
  }
}
