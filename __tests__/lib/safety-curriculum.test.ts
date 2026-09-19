import { SAFETY_CURRICULUM, SAFETY_MODULES, getSafetyLesson } from '@/lib/safety-curriculum';

describe('safety curriculum', () => {
  it('has unique, addressable modules with complete lesson content', () => {
    const ids = SAFETY_MODULES.map((module) => module.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(5);

    for (const lesson of SAFETY_CURRICULUM) {
      expect(getSafetyLesson(lesson.module.id)).toBe(lesson);
      expect(lesson.concepts.length).toBeGreaterThanOrEqual(3);
      expect(lesson.quickActions.length).toBe(3);
      expect(lesson.quiz.length).toBeGreaterThanOrEqual(3);
      expect(lesson.sources.length).toBeGreaterThan(0);
    }
  });

  it('keeps every quiz answer and source structurally valid', () => {
    for (const lesson of SAFETY_CURRICULUM) {
      for (const question of lesson.quiz) {
        expect(question.options).toHaveLength(4);
        expect(question.correctIndex).toBeGreaterThanOrEqual(0);
        expect(question.correctIndex).toBeLessThan(question.options.length);
        expect(question.options[question.correctIndex]).toBeTruthy();
      }
      for (const source of lesson.sources) {
        expect(source.url).toMatch(/^https:\/\//);
      }
    }
  });
});
