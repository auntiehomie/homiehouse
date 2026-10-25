import { KNOWLEDGE_LIBRARY_CURRICULUM } from './knowledge-library-curriculum';
import { SAFETY_CURRICULUM } from './safety-curriculum';
import { NETWORK_STATE_CURRICULUM } from './network-state-curriculum';

export const CURATED_CURRICULUM = [...SAFETY_CURRICULUM, ...NETWORK_STATE_CURRICULUM, ...KNOWLEDGE_LIBRARY_CURRICULUM];
export const CURATED_MODULES = CURATED_CURRICULUM.map(({ module }) => module);

export function getCuratedLesson(id: string) {
  return CURATED_CURRICULUM.find(({ module }) => module.id === id);
}
