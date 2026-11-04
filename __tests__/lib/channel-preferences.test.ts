import {
  addSavedChannel,
  readSavedChannels,
  removeSavedChannel,
} from '@/lib/channel-preferences';

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

describe('saved channel preferences', () => {
  it('adds a channel once per FID and normalizes its ID', () => {
    const storage = createStorage();

    addSavedChannel(123, { id: '/base', name: 'Base' }, storage);
    const result = addSavedChannel(123, { id: 'BASE', name: 'Base chain' }, storage);

    expect(result).toEqual([{ id: 'BASE', name: 'Base chain' }]);
    expect(readSavedChannels(456, storage)).toEqual([]);
  });

  it('removes only the selected channel', () => {
    const storage = createStorage();
    addSavedChannel(123, { id: 'base' }, storage);
    addSavedChannel(123, { id: 'ethereum' }, storage);

    expect(removeSavedChannel(123, '/BASE', storage)).toEqual([{ id: 'ethereum' }]);
  });

  it('ignores malformed stored data', () => {
    const storage = createStorage();
    storage.setItem('hh_saved_channels_v1:123', '{broken');

    expect(readSavedChannels(123, storage)).toEqual([]);
  });
});
