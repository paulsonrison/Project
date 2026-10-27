import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildWorkbook, parseWorkbook, type WorkbookContext } from './workbook.js';
const context: WorkbookContext = { id: 'template-1', entity: 'residents', mode: 'update', locale: 'en', records: [{ id: 'r1', revision: 2, name: 'അനു', unit: '001', phone: '+919000000001' }], publications: [{ id: 'p1', revision: 0, name: 'Malayala Manorama', code: 'MM' }, { id: 'p2', revision: 0, name: 'The Hindu', code: 'HD' }], subscriptions: [{ residentId: 'r1', publicationId: 'p1', quantity: 2 }] };
describe('contextual Excel', () => {
  it('round trips existing rows, text identifiers and one quantity column per publication', async () => {
    const result = await parseWorkbook(await buildWorkbook(context));
    expect(result.templateId).toBe('template-1');
    expect(result.rows[0]).toMatchObject({ 'Customer ID': 'r1', Name: 'അനു', Number: '+919000000001', 'Address/Flat': '001', 'Subscription: MM': '2' });
    expect(result.headers).toContain('Subscription: HD');
  });
  it('add templates contain no existing personal records', async () => {
    const result = await parseWorkbook(await buildWorkbook({ ...context, mode: 'add' }));
    expect(result.rows).toHaveLength(0);
  });
  it('includes existing rate history as reference without silently re-uploading prices',async()=>{
    const paper={id:'p1',revision:0,name:'Manorama',code:'MM',basePrice:600,schedule:'daily',priceHistory:[{effectiveDate:'2026-10-01',price:600}]};
    const book=new ExcelJS.Workbook();await book.xlsx.load(await buildWorkbook({...context,entity:'publications',records:[paper],publications:[paper]}));
    expect(book.getWorksheet('Rates')?.getCell('E2').value).toBe(6);
    expect(book.getWorksheet('Data')?.getCell('G2').text).toBe('');
  });
  it('rejects formula inputs instead of evaluating them', async () => {
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(await buildWorkbook(context));
    workbook.getWorksheet('Data')!.getCell('D2').value = { formula: '1+1', result: 2 };
    await expect(parseWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()))).rejects.toThrow(/formula/i);
  });
  it('rejects unlabelled columns rather than silently dropping their values',async()=>{
    const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await buildWorkbook(context));
    workbook.getWorksheet('Data')!.getCell('D1').value='';
    await expect(parseWorkbook(Buffer.from(await workbook.xlsx.writeBuffer()))).rejects.toThrow(/header/i);
  });
  it('rejects archives lying about their inflated size before ExcelJS reads them',async()=>{
    const buffer=await buildWorkbook(context),central=buffer.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
    expect(central).toBeGreaterThan(0);buffer.writeUInt32LE(1,central+24);
    await expect(parseWorkbook(buffer)).rejects.toThrow(/archive/i);
  });
});
