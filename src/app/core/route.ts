/* eslint-disable no-unused-vars */
import express from 'express';
import { Router } from 'express';

export type HandlerFunction = (
  request: express.Request,
  response: express.Response,
  next: express.NextFunction
) => any | Promise<any>;

type HttpMethod = 'delete' | 'get' | 'patch' | 'post';

interface RouteDef {
  method: HttpMethod;
  middleware: HandlerFunction[];
  path: `/${string}`;
  propertyKey: string;
}

export class Context {
  /**
   * Unsafe context
   * return: null
   */
  static get Null(): Context {
    return null as unknown as Context;
  }

  constructor(
    public request: express.Request,
    public response: express.Response,
    public next: express.NextFunction
  ) {}
}

const ROUTES_META = Symbol('ROUTES_META');

export interface RegisteredRoute {
  controller: string;
  method: HttpMethod;
  middleware: HandlerFunction[];
  path: string;
  propertyKey: string;
}

const registeredRoutes: RegisteredRoute[] = [];

/**
 * Every route mounted through `@Controller` is recorded here so the OpenAPI
 * document can be generated from the live routing table rather than a
 * hand-maintained spec.
 */
export function getRegisteredRoutes(): readonly RegisteredRoute[] {
  return registeredRoutes;
}

export function Controller(basePath: `/${string}` = '/') {
  return function <T extends new (...args: any[]) => any>(Constructor: T) {
    return class extends Constructor {
      router = Router();

      constructor(...args: any[]) {
        super(...args);

        const routes: RouteDef[] =
          (Constructor.prototype as any)[ROUTES_META] ?? [];

        const prefix = basePath === '/' ? '' : basePath;

        for (const r of routes) {
          const handler = (this as any)[r.propertyKey].bind(this);
          const fullPath = `${prefix}${r.path}`;

          this.router[r.method](
            fullPath,
            ...r.middleware,
            (request, response, next) => handler(request, response, next)
          );

          registeredRoutes.push({
            controller: Constructor.name,
            method: r.method,
            middleware: r.middleware,
            path: fullPath,
            propertyKey: r.propertyKey,
          });
        }
      }
    };
  };
}

export function RequestMapper({
  method = 'get',
  middleware = [],
  path,
}: {
  method?: HttpMethod;
  middleware?: HandlerFunction[];
  path: `/${string}`;
}) {
  return function (target: any, propertyKey: string) {
    const list: RouteDef[] = target[ROUTES_META] ?? [];
    list.push({ method, middleware, path, propertyKey });
    target[ROUTES_META] = list;
  };
}
