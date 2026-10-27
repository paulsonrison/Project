import {test,expect} from '@playwright/test';
import ExcelJS from 'exceljs';
import {acceptDefaultSetup} from './helpers';
test('one upload action reads ordinary CSV, reviews before saving and supports sample Excel',async({page},testInfo)=>{
 await page.goto('/signin?mode=register');await page.getByLabel('Your name').fill('Upload Owner');await page.getByLabel('Email address').fill(`upload-${Date.now()}@example.test`);await page.getByLabel('Society / business name').fill('Upload Round');await page.getByLabel('Password',{exact:true}).fill('upload-owner-password-123');await page.getByRole('button',{name:'Create workspace'}).click();await acceptDefaultSetup(page);
 await page.locator('.sidebar').getByRole('link',{name:'Customers'}).click();
 await expect(page.getByRole('button',{name:'Upload file',exact:true})).toHaveCount(1);await expect(page.getByRole('button',{name:'Add using Excel',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Add with AI',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Upload file',exact:true}).click();await page.getByLabel('Choose a file',{exact:false}).setInputFiles({name:'ordinary.csv',mimeType:'text/csv',buffer:Buffer.from('Full name,Mobile,Flat\nAnu,0012345678,001\nBinu,+919000001234,002')});
 await expect(page.getByRole('heading',{name:'Check details',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Save records',exact:true})).toBeVisible();
 expect((await(await page.request.get('/api/v1/residents')).json()).items).toHaveLength(0);
 await page.getByRole('button',{name:'Save records',exact:true}).click();await expect(page.getByText('Saved 2 changes',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Close dialog',exact:true}).click();await expect(page.getByRole('cell',{name:'Anu',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Upload file',exact:true}).click();const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Download sample',exact:true}).click();const download=await downloading,book=new ExcelJS.Workbook();await book.xlsx.readFile((await download.path())!);expect(book.getWorksheet('Data')!.getCell('D1').text).toBe('Name');
 await page.screenshot({path:testInfo.outputPath('unified-upload.png'),fullPage:true});
});
