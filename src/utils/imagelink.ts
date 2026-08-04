import { Request } from 'express';

export const getImageLink = (
  file: { filename: string; path: string },
  req: Request
): string => {
  const uploadsIndex = file.path.lastIndexOf('uploads');
  if (file.path) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const relativePath = file.path
      .substring(uploadsIndex)
      .replace(/\\/g, '/')
      .replace(/^\/+/, '');

    return `${baseUrl}/${relativePath}`;
  }

  const defaultBaseUrl = `${req.protocol}://${req.get('host')}`;
  return `${defaultBaseUrl}/uploads/${file.filename}`;
};
