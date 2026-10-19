import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { en } from '../../locales/en';
import { de } from '../../locales/de';
import { buildSeasonReport } from './build';
import { renderSeasonReport, reportFileName } from './render';
import { sampleSeason } from './fixture';

describe('renderSeasonReport', () => {
  it.each([['en', en], ['de', de]] as const)('renders a multi-page %s report', async (lang, res) => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: lang, resources: { [lang]: { translation: res } } });
    const report = buildSeasonReport(sampleSeason());
    const doc = renderSeasonReport(report, (k, o) => i18n.t(k, o as any) as string, lang);
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(6);
    expect(reportFileName(report)).toMatch(/\.pdf$/);
  });

  it('prints the MVP and minutes columns and the MVP award', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
    const pdf = renderSeasonReport(buildSeasonReport(sampleSeason()), (k, o) => i18n.t(k, o as any) as string, 'en').output();
    expect(pdf).toContain(`(${en.seasonReport.col.mvp})`);
    expect(pdf).toContain('Lehmann, Sommer');
    expect(pdf).toContain(en.seasonReport.award.mostMotm.toUpperCase());
    expect(pdf).toContain(`(${en.seasonReport.col.minutes})`);
    expect(pdf).toContain("(270')");
  });

  it('translates the venue and says how much attendance and lineup data the numbers rest on', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: 'de', resources: { de: { translation: de } } });
    const input = sampleSeason();
    input.matches[0] = { ...input.matches[0], lineup: undefined };
    const pdf = renderSeasonReport(buildSeasonReport(input), (k, o) => i18n.t(k, o as any) as string, 'de').output();
    expect(pdf).toContain('(Heim)');
    expect(pdf).not.toContain('(Home)');
    expect(pdf).toContain('Aufstellung in 2 von 3 Spielen gespeichert');
    expect(pdf).toMatch(/Anwesenheit in \d+ erfasst/);
  });

  it('drops the starts and minutes columns when no lineup was saved', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
    const input = sampleSeason();
    input.matches = input.matches.map(m => ({ ...m, lineup: undefined }));
    const report = buildSeasonReport(input);
    const pdf = renderSeasonReport(report, (k, o) => i18n.t(k, o as any) as string, 'en').output();
    // Player cards keep both labels; only the squad table header loses them.
    const count = (label: string) => pdf.split(`(${label})`).length - 1;
    expect(count(en.seasonReport.col.minutes)).toBe(report.players.length);
    expect(count(en.seasonReport.col.starts)).toBe(report.players.length);
  });

  it('renders an empty season without throwing', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
    const input = { ...sampleSeason(), players: [], matches: [], matchEvents: {}, ratings: [], substitutions: [], attendance: [], sessions: [], exercises: [], calendarEvents: [] };
    const doc = renderSeasonReport(buildSeasonReport(input), (k, o) => i18n.t(k, o as any) as string, 'en');
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
  });
});
