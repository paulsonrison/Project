import { test, expect } from '@playwright/test';
import ExcelJS from 'exceljs';
test('Excel downloads current newspaper headers and reviews customer changes before commit',async({page},testInfo)=>{
  await page.goto('/signin?mode=register');
  await page.getByLabel('Your name').fill('Excel Owner');await page.getByLabel('Email address').fill(`excel-${Date.now()}@example.test`);await page.getByLabel('Society / business name').fill('Excel Round');await page.getByLabel('Password',{exact:true}).fill('excel-owner-password-123');await page.getByRole('button',{name:'Create workspace'}).click();
  await expect(page.getByRole('heading',{name:'Every morning, a clear start.'})).toBeVisible();
  // Use the authenticated API only to establish the catalog; the entire workbook flow uses the UI.
  const response=await page.request.post('/api/v1/publications',{headers:{Origin:'http://127.0.0.1:5173'},data:{name:'Malayala Manorama',code:'MM',schedule:'daily',basePrice:600}});expect(response.status()).toBe(201);
  await page.getByRole('link',{name:'Customers',exact:false}).click();await page.getByRole('button',{name:'Add using Excel',exact:true}).click();
  const downloadEvent=page.waitForEvent('download');await page.getByRole('button',{name:'2. Download Excel format'}).click();const download=await downloadEvent;
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile((await download.path())!);
  const data=workbook.getWorksheet('Data')!;expect(data.getRow(1).values).toContain('Subscription: MM');
  data.addRow([1,'','','Excel Reader','+919000000001','001','Kochi','2026-11-01','No',1]);
  await page.getByLabel('Upload Excel workbook').setInputFiles({name:'customers.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(await workbook.xlsx.writeBuffer())});
  await expect(page.getByText('1 rows found')).toBeVisible();await page.getByRole('button',{name:'4. Review changes'}).click();
  await expect(page.getByRole('heading',{name:'Review changes',exact:true})).toBeVisible();
  expect((await page.request.get('/api/v1/residents')).status()).toBe(200);expect((await(await page.request.get('/api/v1/residents')).json()).items).toHaveLength(0);
  await page.getByLabel('I reviewed these changes, including any removals and rate changes.').check();await page.getByRole('button',{name:'5. Save reviewed changes'}).click();await expect(page.getByText('Saved 2 changes')).toBeVisible();
  await page.getByRole('button',{name:'Close dialog'}).click();await expect(page.getByRole('cell',{name:'Excel Reader',exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('excel-desktop.png'),fullPage:true});
});
