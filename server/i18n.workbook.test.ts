import { expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildWorkbook } from './imports/workbook';

it.each([['hi', 'अंतिम तारीख'], ['ml', 'അവസാന തീയതി']])('localizes all critical %s instructions while retaining import headers and entered names', async (locale, expected) => {
  const buffer = await buildWorkbook({ id: 'template', entity: 'publications', mode: 'replace', locale, publications: [], subscriptions: [], records: [{ id: 'paper', revision: 1, name: 'Malayala Manorama', code: 'MM', basePrice: 700, schedule: 'daily' }] });
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer as unknown as Parameters<typeof book.xlsx.load>[0]);
  const instructions = book.getWorksheet('Instructions')!;
  const lines = Array.from({ length: instructions.rowCount }, (_, index) => instructions.getCell(index + 1, 1).text);
  expect(lines[3]).not.toContain('Omitted rows never remove records');
  expect(lines[4]).not.toContain('complete scope');
  expect(lines[6]).toContain(expected);
  expect(lines.at(-1)).not.toContain('Blank price cells leave rates unchanged.');
  expect(book.getWorksheet('Data')!.getCell('B1').text).toBe('Newspaper ID');
  expect(book.getWorksheet('Data')!.getCell('D2').text).toBe('Malayala Manorama');
});
