// @vitest-environment jsdom
import { createElement } from 'react';
import { afterEach,expect,it,vi } from 'vitest';
import { cleanup,render,screen,waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PreferencesPanel from '../../src/features/settings/PreferencesPanel';
import { I18nProvider } from '../../src/i18n';
import { AccountContext } from '../../src/features/workspace/context';
const owner={userId:'owner',societyId:'business',role:'admin' as const,name:'Owner',email:'owner@example.test',society:{name:'Test',currency:'INR',timezone:'Asia/Kolkata'}};
const base={revision:0,locale:'en-IN',localeSaved:false,onboardingVersion:0,ai:{revision:0,source:'default',provider:'groq',hasCustomKey:false,customKeysAvailable:true}};
afterEach(()=>{cleanup();vi.unstubAllGlobals();localStorage.clear();});
function panel(onSaved=vi.fn()){return render(createElement(I18nProvider,null,createElement(AccountContext.Provider,{value:owner},createElement(PreferencesPanel,{onboarding:true,onSaved}))));}
it('selects included AI by default and saves first-use language without requesting a key',async()=>{
  const writes:Record<string,unknown>[]=[],onSaved=vi.fn();
  vi.stubGlobal('fetch',async(_url:string,options?:RequestInit)=>{if(options?.body)writes.push(JSON.parse(String(options.body)));return new Response(JSON.stringify(options?.body?{...base,revision:1,onboardingVersion:1}:base));});
  panel(onSaved);const included=await screen.findByLabelText('Use included AI');expect((included as HTMLInputElement).checked).toBe(true);expect(screen.queryByLabelText('Groq API key')).toBeNull();
  await userEvent.click(screen.getByRole('button',{name:'Continue'}));await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());
  expect(writes[0]).toMatchObject({locale:'en-IN',onboardingVersion:1,aiSource:'default'});expect(JSON.stringify(writes)).not.toContain('key');
});
it('requires a verified owner key and clears the input after saving',async()=>{
  const requests:{url:string;method?:string;body:Record<string,unknown>}[]=[],onSaved=vi.fn();
  vi.stubGlobal('fetch',async(url:string,options?:RequestInit)=>{
    const body=options?.body?JSON.parse(String(options.body)):{};if(options?.body)requests.push({url,method:options.method,body});
    const result=url.endsWith('/ai-key/test')?{valid:true,verificationId:'verification'}:url.endsWith('/ai-key')?{...base,ai:{...base.ai,revision:1,source:'custom',hasCustomKey:true}}:options?.body?{...base,revision:1,onboardingVersion:1,ai:{...base.ai,revision:2,source:'custom',hasCustomKey:true}}:base;
    return new Response(JSON.stringify(result));
  });
  panel(onSaved);await userEvent.click(await screen.findByLabelText('Use my own API key'));await userEvent.type(screen.getByLabelText('Groq API key'),'synthetic-owner-key-more-than-twenty');
  await userEvent.click(screen.getByRole('button',{name:'Continue'}));expect((await screen.findByRole('alert')).textContent).toContain('Test your key before saving.');expect(requests).toHaveLength(0);
  await userEvent.click(screen.getByRole('button',{name:'Test key'}));await screen.findByText('Key verified. Save to use it.');await userEvent.click(screen.getByRole('button',{name:'Continue'}));await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());
  expect(requests.map(r=>r.url)).toEqual(['/api/v1/preferences/ai-key/test','/api/v1/preferences/ai-key','/api/v1/preferences']);expect((screen.getByLabelText('Replace Groq API key') as HTMLInputElement).value).toBe('');
});
