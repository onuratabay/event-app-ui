/** Native 24 × 24 line artwork shared by activity selection, previews and interest chips. */
export const CATEGORY_PATHS = {
  padel: 'M18 3c3 2 3 6 0 9s-6 4-9 1-2-6 1-9 6-3 8-1ZM9 13l-5 7m1-1 2 2M12 6h.01M15 5h.01M17 7h.01M11 9h.01M14 8h.01M16 10h.01M13 11h.01',
  tennis: 'M19 3c3 3 2 7-1 10s-7 4-10 1-2-7 1-10 7-4 10-1ZM8 14l-5 7m3-5 2 2M10 5l8 8m-6-10 9 8M8 8l9-5M8 11l12-6M11 14l10-6',
  running: 'M15 4a2 2 0 1 0 0 .01ZM4 10l4-2 4 2 3-3 3 4 3 1M12 10l-3 5 5 2 2 4M9 15l-3 5H2M3 5h5M2 8h3',
  cycling: 'M9 16a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm13 0a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM5.5 16 10 8l3 8H5.5M10 8h6.5l2 8M10 8V5.5M8.5 5.5h3M16.5 8l-1-2.5M14.5 5.5H17',
  hiking: 'm2 20 7-15 5 10 3-6 5 11H2Zm4-9 3 3 3-3',
  coffee: 'M4 8h12v6a5 5 0 0 1-10 0V8m10 1h2a3 3 0 0 1 0 6h-2M5 21h14M8 3v2m4-2v2',
  food: 'M3 3v5a3 3 0 0 0 6 0V3M6 3v18M3 7h6M20 21V3c-4 2-5 6-5 10h5',
  concert: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3c2 0 3 1 3 3Zm11-2a3 3 0 1 1-3-3c2 0 3 1 3 3Z',
  nightlife: 'M3 4h18l-9 9L3 4Zm9 9v8M7 21h10M7 8h10M16 4l3-2',
  art: 'M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4h-1a2 2 0 0 1 0-4h4a4 4 0 0 0 4-4c0-3-4-6-9-6Zm-5 7h.01M10 6h.01m5 1h.01',
  travel: 'm21 3-5 14-4-5-5-4L21 3ZM12 12l-7 7M3 14l2 5 5 2',
  yoga: 'M12 4a2 2 0 1 0 0 .01ZM8 10l-2 4H3m13-4 2 4h3M8 10l4 2 4-2M12 12v4m0 0-5-1-4 4c3 3 6 2 9 0 3 2 6 3 9 0l-4-4-5 1Z',
  film: 'M3 8h18v12H3V8Zm0 0L2 4l18-3 1 4L3 8ZM7 3l3 4m3-5 3 4M10 12l5 3-5 3v-6Z',
  photography: 'M3 7h4l2-3h6l2 3h4v13H3V7Zm13 6a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM18 10h.01',
  camping: 'm2 21 10-17 10 17H2Zm6 0 4-7 4 7M10 2l4 4',
  dance: 'M14 4a2 2 0 1 0 0 .01ZM4 6l5 4 5-1 5-4M10 10l2 5 6 2 3 4M12 15l-5 2-4-2',
  swimming: 'M2 16c3-3 4 3 7 0s4 3 7 0 4 3 6 0M2 21c3-3 4 3 7 0s4 3 7 0 4 3 6 0M7 12l5-5 5 5m-5-5L8 3m8 1a2 2 0 1 0 0 .01',
  generic: 'M5 5h14v16H5V5ZM8 3v4m8-4v4M5 10h14M9 15h6m-3-3v6',
} as const;

// Normalize Turkish letters and slug separators before matching; English labels are supported too.
const normalize = (value: string) => value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[-_]+/g, ' ');
const RULES: Array<[RegExp, keyof typeof CATEGORY_PATHS]> = [
  [/padel/, 'padel'], [/tenis|tennis|raket/, 'tennis'], [/kosu|running|jogging/, 'running'],
  [/bisiklet|cycling/, 'cycling'], [/kamp|camping/, 'camping'], [/yuruyus|doga|hiking|trekking|tirman/, 'hiking'],
  [/kahve|coffee/, 'coffee'], [/yemek|food|dining/, 'food'], [/gece hayati|nightlife/, 'nightlife'],
  [/dans|dance/, 'dance'], [/muzik|konser|concert|music/, 'concert'], [/sanat|resim|seramik|\bart\b/, 'art'],
  [/seyahat|travel/, 'travel'], [/yoga|meditasyon|meditation/, 'yoga'], [/film|sinema|movie|cinema/, 'film'],
  [/fotograf|photography|photo/, 'photography'], [/yuzme|deniz|swimming/, 'swimming'],
];
export function categoryIconPath(name: string, slug?: string): string {
  // A stable catalog slug takes priority over display wording.
  for (const value of [slug, name]) {
    if (!value) continue;
    const key = normalize(value);
    const match = RULES.find(([pattern]) => pattern.test(key));
    if (match) return CATEGORY_PATHS[match[1]];
  }
  return CATEGORY_PATHS.generic;
}
