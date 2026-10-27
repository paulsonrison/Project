import {afterEach,it,expect,vi} from 'vitest';
import {interpretStructure} from './interpret.js';
afterEach(()=>vi.unstubAllGlobals());
it('sends structural labels only and never customer data, unknown headers or filenames',async()=>{
  let body='';vi.stubGlobal('fetch',async(_url:string,options:RequestInit)=>{body=String(options.body);return new Response(JSON.stringify({choices:[{message:{content:'{"recognized":true}'}}]}));});
  const result=await interpretStructure({mongoUri:'mongodb://localhost',database:'test',origin:'http://localhost',port:3001,production:false,groqKey:'secret-key',groqModel:'test'},{rows:[{Name:'Private Anu',Number:'9000012345',Address:'Private Home'}],columns:['Name','Number','Address'],unmapped:['Private scan title'],sources:[{filename:'private-customer-list.csv'}],issues:[]});
  expect(result.aiUsed).toBe(true);for(const secret of ['Private Anu','9000012345','Private Home','Private scan title','private-customer-list','secret-key'])expect(body).not.toContain(secret);
});
it('leaves extraction review usable when the selected provider fails',async()=>{
  vi.stubGlobal('fetch',async()=>new Response('{}',{status:503}));
  expect((await interpretStructure({mongoUri:'mongodb://localhost',database:'test',origin:'http://localhost',port:3001,production:false,groqKey:'key',groqModel:'test'},{rows:[],columns:[],unmapped:[],sources:[],issues:[]})).aiUsed).toBe(false);
});
