/**
 * Middleware tagging helpers.
 *
 * Route middleware are opaque functions once registered, so the OpenAPI
 * generator cannot tell an auth guard from a validator. These helpers attach a
 * small descriptor to the middleware function itself; the generator reads it
 * back and nothing else in the request pipeline is affected.
 */
import { z } from 'zod';

import type { HandlerFunction } from '../route';

const VALIDATION_META = Symbol('OPENAPI_VALIDATION_META');
const SECURITY_META = Symbol('OPENAPI_SECURITY_META');

export interface ValidationMeta {
  schema: z.Schema;
  target: 'BODY' | 'QUERY';
}

export interface SecurityMeta {
  roles?: string[];
}

export function describeValidation<T extends HandlerFunction>(
  handler: T,
  target: ValidationMeta['target'],
  schema: z.Schema
): T {
  (handler as any)[VALIDATION_META] = { schema, target } satisfies ValidationMeta;
  return handler;
}

export function getValidationMeta(
  handler: HandlerFunction
): undefined | ValidationMeta {
  return (handler as any)?.[VALIDATION_META];
}

export function describeSecurity<T extends HandlerFunction>(
  handler: T,
  meta: SecurityMeta = {}
): T {
  (handler as any)[SECURITY_META] = meta satisfies SecurityMeta;
  return handler;
}

export function getSecurityMeta(
  handler: HandlerFunction
): SecurityMeta | undefined {
  return (handler as any)?.[SECURITY_META];
}
