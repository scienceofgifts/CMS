import { ContentRepository } from './ContentRepository';
import { LocalDiskRepository } from './LocalDiskRepository';

export const contentRepository: ContentRepository = new LocalDiskRepository();

export * from './ContentRepository';
export * from './LocalDiskRepository';
