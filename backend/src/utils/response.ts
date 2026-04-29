import type { Response } from 'express';

export function success(res: Response, data: unknown = {}, message = 'success', status = 200) {
  return res.status(status).json({
    code: status,
    message,
    data
  });
}

export function fail(res: Response, message = 'error', status = 400, data: unknown = null) {
  return res.status(status).json({
    code: status,
    message,
    data
  });
}
