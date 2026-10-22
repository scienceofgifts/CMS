import { contentRepository } from './storage';
import { AiSettingsData } from '../src/types/aiSettings';

export async function getAiSettings(): Promise<AiSettingsData> {
  return contentRepository.getAiSettings();
}

export async function saveAiSettings(settings: Partial<AiSettingsData>): Promise<AiSettingsData> {
  return contentRepository.saveAiSettings(settings);
}
