// @vitest-environment jsdom
import {createElement} from 'react';
import {it,expect,vi,beforeAll,afterEach} from 'vitest';
import {render,screen,cleanup,waitFor,act} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UploadDialog from '../../src/features/imports/UploadDialog';
import {I18nProvider} from '../../src/i18n';
beforeAll(()=>{Object.defineProperty(HTMLDialogElement.prototype,'showModal',{configurable:true,value(){this.setAttribute('open','');}});Object.defineProperty(HTMLDialogElement.prototype,'close',{configurable:true,value(){this.removeAttribute('open');}});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();localStorage.clear();});
function mockFile(delayed=false){
 let release:(response:Response)=>void=()=>{};
 vi.stubGlobal('fetch',async(path:string)=>{
  if(path.startsWith('/api/v1/publications'))return new Response(JSON.stringify({items:[]}));
  if(path==='/api/v1/uploads')return new Response(JSON.stringify({id:'u1',status:'uploaded'}));
  if(path==='/api/v1/uploads/u1')return new Response(JSON.stringify({id:'u1',revision:1,status:'needs-review',rows:[{Name:'Anu','Address/Flat':'001','Subscription: MM':'1','Customer ID':'r1',Revision:'0'}],issues:[]}));
  if(path.endsWith('/preview'))return delayed?await new Promise<Response>(resolve=>{release=resolve;}):new Response(JSON.stringify({id:'p1',revision:2,changes:[{action:'update',label:'Anu',collection:'residents'}],errors:[]}));
  throw new Error('Unexpected request');
 });return()=>release(new Response(JSON.stringify({id:'p1',revision:2,changes:[],errors:[]})));
}
async function upload(){const user=userEvent.setup();render(createElement(I18nProvider,null,createElement(UploadDialog,{entity:'residents',onSaved:()=>{}})));await user.click(screen.getByRole('button',{name:'Upload file'}));await user.upload(screen.getByLabelText(/Choose a file/),new File(['Name,Flat\nAnu,001'],'a.csv',{type:'text/csv'}));return user;}
it('locks date fields during a pending preview so the saved date cannot differ from the displayed review',async()=>{
 const release=mockFile(true);await upload();const date=await screen.findByLabelText('Start date for subscriptions');await waitFor(()=>expect((date as HTMLInputElement).disabled).toBe(true));expect((screen.getByRole('button',{name:'Download sample',hidden:true}) as HTMLButtonElement).disabled).toBe(true);await act(async()=>release());await waitFor(()=>expect((date as HTMLInputElement).disabled).toBe(false));
});
it('shows editable explicit removal flags when removal is selected',async()=>{
 mockFile();const user=await upload();await screen.findByRole('heading',{name:'Check details'});await waitFor(()=>expect((screen.getByLabelText('Start date for subscriptions') as HTMLInputElement).disabled).toBe(false));await user.click(screen.getByText('More options'));await user.selectOptions(screen.getByLabelText('How should these records be added?'),'remove');expect(await screen.findByLabelText('Remove? 1')).toBeTruthy();
});
