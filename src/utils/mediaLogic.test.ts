import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterAndSortMedia,
  resolveEmbedUrl,
  searchMediaCatalog,
  upsertWatchProgress,
} from './mediaLogic';
import { SEED_MEDIA_CATALOG } from '../data/seedCatalog';

test('filterAndSortMedia filters by Movies tab and Cyberpunk genre', () => {
  const results = filterAndSortMedia(SEED_MEDIA_CATALOG, {
    tab: 'movies',
    genre: 'Cyberpunk',
    sortBy: 'trending',
    watchlistIds: [],
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].title, 'Blade Runner 2049');
});

test('filterAndSortMedia sorts by most recently added when sortBy is recent', () => {
  const results = filterAndSortMedia(SEED_MEDIA_CATALOG, {
    tab: 'home',
    genre: 'All',
    sortBy: 'recent',
    watchlistIds: [],
  });

  assert.ok(results.length >= 3);
  const firstDate = new Date(results[0].addedAt).getTime();
  const secondDate = new Date(results[1].addedAt).getTime();
  assert.ok(firstDate >= secondDate, 'Expected newest item first');
});

test('filterAndSortMedia returns only watchlisted items on library tab', () => {
  const targetId = SEED_MEDIA_CATALOG[2].id;
  const results = filterAndSortMedia(SEED_MEDIA_CATALOG, {
    tab: 'library',
    genre: 'All',
    sortBy: 'trending',
    watchlistIds: [targetId],
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].id, targetId);
});

test('searchMediaCatalog ranks exact and prefix title matches first', () => {
  const results = searchMediaCatalog(SEED_MEDIA_CATALOG, 'Severance');
  assert.ok(results.length >= 1);
  assert.equal(results[0].title, 'Severance');

  const studioSearch = searchMediaCatalog(SEED_MEDIA_CATALOG, 'Trigger');
  assert.equal(studioSearch[0].title, 'Cyberpunk: Edgerunners');
});

test('resolveEmbedUrl constructs valid VidSrc and 2Embed URLs for movies and series', () => {
  const movie = SEED_MEDIA_CATALOG.find((m) => m.id === 'tmdb-693134')!;
  const vidsrcMovie = resolveEmbedUrl(movie, 'vidsrc');
  assert.equal(vidsrcMovie, 'https://vidsrc.xyz/embed/movie?tmdb=693134');

  const twoEmbedMovie = resolveEmbedUrl(movie, 'twoembed');
  assert.equal(twoEmbedMovie, 'https://www.2embed.cc/embed/693134');

  const series = SEED_MEDIA_CATALOG.find((m) => m.id === 'tmdb-95396')!;
  const vidsrcTv = resolveEmbedUrl(series, 'vidsrc', 2, 3);
  assert.equal(vidsrcTv, 'https://vidsrc.xyz/embed/tv?tmdb=95396&season=2&episode=3');

  const previewMode = resolveEmbedUrl(series, 'preview', 2, 3);
  assert.equal(previewMode, null);
});

test('upsertWatchProgress clamps bounds and moves updated item to front', () => {
  const initial = [
    {
      mediaId: 'tmdb-693134',
      season: 1,
      episode: 1,
      progressPercent: 45,
      remainingMinutes: 90,
      updatedAt: '2026-10-20T10:00:00Z',
    },
  ];

  const updated = upsertWatchProgress(initial, {
    mediaId: 'tmdb-76600',
    season: 1,
    episode: 1,
    progressPercent: 68.4,
    remainingMinutes: 58,
    updatedAt: '2026-10-24T12:00:00Z',
  });

  assert.equal(updated.length, 2);
  assert.equal(updated[0].mediaId, 'tmdb-76600');
  assert.equal(updated[0].progressPercent, 68);
});
