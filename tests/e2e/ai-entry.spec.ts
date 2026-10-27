import { test,expect } from '@playwright/test';
test('AI entry shows only nonpersonal choices and keeps private customer fields on the local save path',async({page})=>{
  await page.goto('/signin?mode=register');
  await page.getByLabel('Your name').fill('Privacy Owner');await page.getByLabel('Email address').fill(`privacy-${Date.now()}@example.test`);await page.getByLabel('Society / business name').fill('Privacy Round');await page.getByLabel('Password',{exact:true}).fill('privacy-password-12345');await page.getByRole('button',{name:'Create workspace'}).click();
  await expect(page.getByRole('heading',{name:'Every morning, a clear start.'})).toBeVisible();
  await page.request.post('/api/v1/publications',{headers:{Origin:'http://127.0.0.1:5173'},data:{name:'Malayala Manorama',code:'MM',basePrice:600,schedule:'daily'}});
  await page.getByRole('link',{name:'Customers',exact:false}).click();await page.getByRole('button',{name:'Add with AI',exact:true}).click();
  await page.getByLabel('Full name',{exact:true}).fill('Private Reader');await page.getByLabel('Address/Flat',{exact:true}).fill('Private Flat');await page.getByLabel('Phone',{exact:true}).fill('9000012345');await page.getByLabel('Address',{exact:true}).fill('Private Address');await page.getByLabel('First delivery date').fill('2090-01-01');await page.getByLabel(/Malayala Manorama/).fill('2');
  await page.getByRole('button',{name:'Review what Groq would receive'}).click();await expect(page.getByRole('heading',{name:'Newspaper choices for Groq'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Prepare with Groq'})).toBeDisabled();
  let aiPayload='';
  await page.route('**/api/v1/ai-entry/propose',async route=>{
    aiPayload=route.request().postData()||'';
    await route.fulfill({json:{subscriptions:[{code:'MM',quantity:2,startDate:'2090-01-01'}]}});
  });
  await page.getByLabel('I agree to send only these newspaper choices to Groq.').check();await page.getByRole('button',{name:'Prepare with Groq'}).click();await expect(page.getByRole('heading',{name:'Proposed subscriptions'})).toBeVisible();
  for(const value of ['Private Reader','Private Flat','9000012345','Private Address'])expect(aiPayload).not.toContain(value);
  await page.getByRole('button',{name:'Review customer and subscriptions'}).click();await expect(page.getByRole('heading',{name:'Review changes',exact:true})).toBeVisible();
  await page.getByLabel('I reviewed these changes',{exact:true}).check();await page.getByRole('button',{name:'Save reviewed changes',exact:true}).click();await expect(page.getByText('Customer and subscriptions saved.',{exact:true})).toBeVisible();
  expect((await(await page.request.get('/api/v1/subscriptions')).json()).items).toHaveLength(1);
});
