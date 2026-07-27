import { describe, it, expect, vi } from 'vitest';
import { pickShortVideo, favoriteKey, getShortVideoFavorites, toggleShortVideoFavorite, saveShortVideoBoon } from '../short-video';

describe('short-video', () => {
  describe('pickShortVideo', () => {
    it('should return a video and reflection', () => {
      const result = pickShortVideo('test-seed');
      expect(result.video).toBeDefined();
      expect(result.video.id).toBeTruthy();
      expect(result.video.title).toBeTruthy();
      expect(result.reflection).toContain(result.video.title);
    });

    it('should be deterministic for same seed', () => {
      const r1 = pickShortVideo('deterministic');
      const r2 = pickShortVideo('deterministic');
      expect(r1.video.id).toBe(r2.video.id);
    });
  });

  describe('favoriteKey', () => {
    it('should return the correct key format', () => {
      expect(favoriteKey('user-1')).toBe('short-video-favs:user-1');
    });
  });

  describe('getShortVideoFavorites', () => {
    it('should return empty array when localStorage is unavailable', () => {
      const favs = getShortVideoFavorites('user-1');
      expect(favs).toEqual([]);
    });
  });

  describe('toggleShortVideoFavorite', () => {
    it('should return empty array when localStorage is unavailable', () => {
      const video = { id: 'sv_cultivator', title: 'test', tag: 'tag', mood: 'mood' };
      const result = toggleShortVideoFavorite('user-1', video);
      expect(result).toEqual([]);
    });
  });

  describe('saveShortVideoBoon', () => {
    it('should return empty array when localStorage is unavailable', () => {
      const boon = { id: 'b1', title: 'test', narrative: 'test', type: 'boon' as const };
      const result = saveShortVideoBoon('user-1', boon);
      expect(result).toEqual([]);
    });
  });
});