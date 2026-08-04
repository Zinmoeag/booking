import { Env } from './env/env.schema';

export type ConfigKeys = keyof Env;
export type Configs = Env;

class AppConfig {
  private static _instance: AppConfig;

  private static configs: Partial<Configs> = {};

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getAllConfigs(): Partial<Configs> {
    return this.configs;
  }

  static getConfig<K extends ConfigKeys>(key: K): Env[K] {
    if (key === undefined || !(key in this.configs)) {
      throw new Error(`Invalid config key: ${key}`);
    }
    return this.configs[key]!;
  }

  static register(configs: Configs): AppConfig {
    this.getInstance();

    Object.entries(configs).forEach(([key, value]) => {
      if (!value) {
        throw new Error(`value of ${key} cannot be null`);
      }
      this.configs[key as ConfigKeys] = value;
    });
    return this;
  }

  private static getInstance(): AppConfig {
    if (!this._instance) {
      this._instance = new AppConfig();
    }
    return this._instance;
  }
}

export default AppConfig;
