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

  it('renders an empty season without throwing', async () => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
    const input = { ...sampleSeason(), players: [], matches: [], matchEvents: {}, ratings: [], substitutions: [], attendance: [], sessions: [], exercises: [], calendarEvents: [] };
    const doc = renderSeasonReport(buildSeasonReport(input), (k, o) => i18n.t(k, o as any) as string, 'en');
    expect(doc.getNumberOfPages()).toBeGreaterThan(0);
  });
});
