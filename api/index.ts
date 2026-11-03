import type { Request, Response } from 'express';
import { createApp } from '../server';
const application = createApp();
export default async function handler(req: Request, res: Response) {
  return (await application)(req, res);
}
