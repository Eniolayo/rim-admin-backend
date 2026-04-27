/**
 * Minimal subset of the Multer File interface needed by the ingest module.
 * Defined locally because @types/multer is not installed.
 * Production note: add @types/multer to devDependencies when @nestjs/platform-express
 * is in use and TypeScript strict mode augments Express.Multer.File globally.
 */
export interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  destination: string;
  filename: string;
  path: string;
  buffer: Buffer;
}
