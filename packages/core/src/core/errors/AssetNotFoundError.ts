import { BaseError } from './BaseError';

export class AssetNotFoundError extends BaseError {
  constructor(assetName: string, searchPath?: string) {
    let message = `Asset not found: ${assetName}`;

    if (searchPath) {
      message += ` (Searched in: ${searchPath})`;
    }
    super(message);
  }
}
