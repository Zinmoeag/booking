/**
 * Builds an OpenAPI 3.0 document from the live routing table.
 *
 * Nothing here is hand-maintained: paths come from the `@Controller` /
 * `@RequestMapper` registry, request schemas come from the zod schemas already
 * attached to the validation middleware, and auth requirements come from the
 * tagged auth guards. Adding a route to a controller adds it to the docs.
 */
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { getRegisteredRoutes, HandlerFunction } from '../route';
import { getSecurityMeta, getValidationMeta } from './metadata';

const RESPONSE_ENVELOPES = {
  DetailResponse: {
    type: 'object',
    properties: {
      result: { description: 'The requested resource' },
      status: { type: 'integer', example: 200 },
      meta: {
        type: 'object',
        properties: { message: { type: 'string' } },
        additionalProperties: true,
      },
    },
  },
  GenericResponse: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      status: { type: 'integer', example: 200 },
      error: { description: 'Present only on failure' },
    },
  },
  ListResponse: {
    type: 'object',
    properties: {
      count: { type: 'integer', description: 'Total rows matching the filter' },
      result: { type: 'array', items: {} },
      status: { type: 'integer', example: 200 },
      meta: {
        type: 'object',
        properties: { message: { type: 'string' } },
        additionalProperties: true,
      },
    },
  },
} as const;

/** `/api/hotels/:id` -> `/api/hotels/{id}` */
function toOpenApiPath(expressPath: string): string {
  return expressPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function extractPathParams(expressPath: string): string[] {
  return [...expressPath.matchAll(/:([A-Za-z0-9_]+)/g)].map(([, name]) => name);
}

/** `HotelController` -> `Hotel`, `RoomTypeController` -> `Room Type` */
function toTag(controllerName: string): string {
  return controllerName
    .replace(/Controller$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2');
}

/** `getById` -> `Get by id` */
function toSummary(propertyKey: string): string {
  const words = propertyKey.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function toJsonSchema(schema: z.Schema): Record<string, any> {
  return zodToJsonSchema(schema as any, {
    $refStrategy: 'none',
    target: 'openApi3',
  }) as Record<string, any>;
}

/**
 * Query strings are parsed with `lodash.set`, so nested groups arrive as
 * `filter[city][contains]=paris` / `pagination[size]=20` / `orderBy[name]=asc`.
 * They are documented as `deepObject` parameters to match that wire format.
 */
function buildQueryParams(schema: z.Schema) {
  const params: Record<string, any>[] = [
    {
      name: 'pagination',
      in: 'query',
      style: 'deepObject',
      explode: true,
      required: false,
      description: 'Send as `pagination[page]=1&pagination[size]=20`.',
      schema: {
        type: 'object',
        properties: {
          page: { type: 'string', example: '1', description: 'Minimum 1' },
          size: { type: 'string', example: '20', description: 'Below 100' },
        },
      },
    },
  ];

  if (!(schema instanceof z.ZodObject)) return params;

  const filterProperties: Record<string, any> = {};
  const orderByProperties: Record<string, any> = {};

  for (const [key, value] of Object.entries(schema.shape)) {
    filterProperties[key] = toJsonSchema(value as z.Schema);
    orderByProperties[key] = { type: 'string', enum: ['asc', 'desc'] };
  }

  if (Object.keys(filterProperties).length === 0) return params;

  params.push(
    {
      name: 'filter',
      in: 'query',
      style: 'deepObject',
      explode: true,
      required: false,
      description:
        'Prisma-style filters, e.g. `filter[city]=Yangon` or ' +
        '`filter[name][contains]=inn`.',
      schema: { type: 'object', properties: filterProperties },
    },
    {
      name: 'orderBy',
      in: 'query',
      style: 'deepObject',
      explode: true,
      required: false,
      description: 'Sort direction per field, e.g. `orderBy[name]=asc`.',
      schema: { type: 'object', properties: orderByProperties },
    }
  );

  return params;
}

function isAuthenticated(middleware: HandlerFunction[]): boolean {
  return middleware.some(
    (fn) => fn.name === 'authenticate' || getSecurityMeta(fn) !== undefined
  );
}

function collectRoles(middleware: HandlerFunction[]): string[] {
  return middleware.flatMap((fn) => getSecurityMeta(fn)?.roles ?? []);
}

function buildOperation(route: ReturnType<typeof getRegisteredRoutes>[number]) {
  const secured = isAuthenticated(route.middleware);
  const roles = collectRoles(route.middleware);
  const isList = route.method === 'get' && !route.path.includes(':');

  const operation: Record<string, any> = {
    operationId: `${toTag(route.controller).replace(/\s/g, '')}_${route.propertyKey}`,
    summary: toSummary(route.propertyKey),
    tags: [toTag(route.controller)],
    parameters: extractPathParams(route.path).map((name) => ({
      name,
      in: 'path',
      required: true,
      schema: { type: 'string' },
    })),
    responses: {
      '200': {
        description: 'Success',
        content: {
          'application/json': {
            schema: {
              $ref: `#/components/schemas/${isList ? 'ListResponse' : 'DetailResponse'}`,
            },
          },
        },
      },
      '422': {
        description: 'Validation failed',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/GenericResponse' },
          },
        },
      },
    },
  };

  if (roles.length > 0) {
    operation.description = `Requires role: ${[...new Set(roles)].join(', ')}.`;
  }

  if (secured) {
    operation.security = [{ bearerAuth: [] }];
    operation.responses['401'] = { description: 'Missing or invalid token' };
    if (roles.length > 0) {
      operation.responses['403'] = { description: 'Insufficient role' };
    }
  }

  for (const fn of route.middleware) {
    const meta = getValidationMeta(fn);
    if (!meta) continue;

    if (meta.target === 'BODY') {
      operation.requestBody = {
        required: true,
        content: {
          'application/json': { schema: toJsonSchema(meta.schema) },
        },
      };
    } else {
      operation.parameters.push(...buildQueryParams(meta.schema));
    }
  }

  // List endpoints paginate even when no query validator is attached
  if (isList && !operation.parameters.some((p: any) => p.name === 'pagination')) {
    operation.parameters.push(...buildQueryParams(z.object({})));
  }

  return operation;
}

export function buildOpenApiDocument({
  serverUrl,
  version = '1.0.0',
}: {
  serverUrl: string;
  version?: string;
}) {
  const paths: Record<string, Record<string, any>> = {};

  for (const route of getRegisteredRoutes()) {
    const path = toOpenApiPath(route.path);
    paths[path] ??= {};
    paths[path][route.method] = buildOperation(route);
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Hotel Booking API',
      version,
      description:
        'Generated from the live Express routing table and the zod schemas ' +
        'attached to each route.',
    },
    servers: [{ url: serverUrl }],
    components: {
      schemas: RESPONSE_ENVELOPES,
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    paths,
  };
}
