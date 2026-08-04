import winston from 'winston';

const { combine, label, printf, timestamp } = winston.format;

export interface LoggerTemplateOptions {
  environment: 'development' | 'production' | 'staging';
  service: string;
}

interface DefaultMeta {
  service: string;
}

type LogLevel =
  | 'critical'
  | 'debug'
  | 'error'
  | 'exception'
  | 'fatal'
  | 'info'
  | 'warn';

export abstract class loggingEngine {
  protected defaultMeta: DefaultMeta = {
    service: 'unknown',
  };
  protected logger: null | winston.Logger = null;
  protected loggerOutputPath = './logger';

  protected module = '';

  constructor() {
    // initialize skeleton method
    this.setDefaultMeta();
    this.setModule();
    this.setLoggerOutputPath();

    // initialize logger
    this.loggerInit();
  }

  private static logFormat({
    logBaseType,
  }: {
    logBaseType: string;
  }): winston.Logform.Format {
    const prodFormat = printf(
      ({ event, label, level, message, meta, service, timestamp }) => {
        return `[${timestamp}] [${level}] [${label}] [${service}]: ${event} : ${message}, ${
          meta ? JSON.stringify(meta) : ''
        }`;
      }
    );

    return combine(
      label({ label: logBaseType }),
      timestamp(),
      winston.format.json(),
      prodFormat
    );
  }

  public debug(event: string, message: string, meta?: any) {
    if (!this.logger) return;
    this.logger.log('debug', message, {
      event,
      meta,
    });
  }

  public error(event: string, message: string, meta?: any) {
    if (!this.logger) return;
    this.logger.log('error', message, {
      event,
      meta,
    });
  }

  public info(event: string, message: string, meta?: any) {
    if (!this.logger) return;
    this.logger.log('info', message, {
      event,
      meta,
    });
  }

  public log(level: LogLevel, event: string, message: string, meta?: any) {
    if (!this.logger) return;
    this.logger.log(level, message, {
      event,
      meta,
    });
  }

  public warn(event: string, message: string, meta?: any) {
    if (!this.logger) return;
    this.logger.log('warn', message, {
      event,
      meta,
    });
  }

  // skeleton method
  protected abstract setDefaultMeta(): void;
  protected abstract setLoggerOutputPath(): void;
  protected abstract setModule(): void;

  private loggerInit() {
    this.logger = winston.createLogger({
      defaultMeta: {
        ...this.defaultMeta,
        module: this.module,
      },
      format: loggingEngine.logFormat({
        logBaseType: this.constructor.name,
      }),
      transports: [
        new winston.transports.File({
          filename: `${this.loggerOutputPath}/error.log`,
          level: 'error',
        }),
        new winston.transports.File({
          filename: `${this.loggerOutputPath}/info.log`,
          level: 'info',
        }),
        new winston.transports.File({
          filename: `${this.loggerOutputPath}/Application.log`,
        }),
      ],
    });
  }
}
