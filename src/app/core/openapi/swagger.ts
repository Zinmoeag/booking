import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

import AppConfig from '@/app/config/app.config';

import { buildOpenApiDocument } from './document';

export const SWAGGER_PATH = '/api/docs';

/**
 * Mount this after all controllers are registered — the document is built from
 * the routing table, which is only complete once every controller has been
 * instantiated.
 */
export function createSwaggerRouter(): Router {
  const router = Router();

  const document = buildOpenApiDocument({
    serverUrl: `http://localhost:${AppConfig.getConfig('PORT')}`,
  });

  router.get(`${SWAGGER_PATH}.json`, (_req, res) => {
    res.json(document);
  });

  router.use(
    SWAGGER_PATH,
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: 'Hotel Booking API',
      swaggerOptions: {
        displayRequestDuration: true,
        persistAuthorization: true,
      },
    })
  );

  return router;
}
