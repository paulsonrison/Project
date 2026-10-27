import {describe,it,expect} from 'vitest';
import {normalizeDocument,publicStructure} from './normalize.js';
const catalog=[{id:'paper-mm',code:'MM',name:'Malayala Manorama'},{id:'paper-hd',code:'HD',name:'The Hindu'}];
const source={filename:'customers.csv'};
describe('private local upload normalization',()=>{
  it('matches common fields and newspaper codes without sending private values for interpretation',()=>{
    const document={format:'csv' as const,tables:[{headers:['Full name','Mobile','Flat','Newspapers','Start date'],rows:[{'Full name':'Private Anu',Mobile:'+919000001234',Flat:'Private B-12',Newspapers:'MM:2,HD','Start date':'2026-11-01'}],source}],blocks:[],warnings:[]};
    const result=normalizeDocument(document,'residents',catalog);
    expect(result.rows).toEqual([{Name:'Private Anu',Number:'+919000001234','Address/Flat':'Private B-12','Start Date':'2026-11-01','Subscription: MM':'2','Subscription: HD':'1'}]);
    const external=JSON.stringify(publicStructure(result));
    for(const secret of ['Private Anu','9000001234','Private B-12','customers.csv'])expect(external).not.toContain(secret);
    expect(external).toContain('Name');
  });
  it('recognizes Hindi/Malayalam fields, retains text identifiers and reports unknown columns locally',()=>{
    const result=normalizeDocument({format:'csv',tables:[{headers:['പേര്','ഫോൺ','ഫ്ലാറ്റ്','റിമാർക്ക്'],rows:[{'പേര്':'അനു','ഫോൺ':'0012345678','ഫ്ലാറ്റ്':'001','റിമാർക്ക്':'Private note'}],source}],blocks:[],warnings:[]},'residents',catalog);
    expect(result.rows[0]).toMatchObject({Name:'അനു',Number:'0012345678','Address/Flat':'001'});
    expect(result.unmapped).toContain('റിമാർക്ക്');expect(JSON.stringify(publicStructure(result))).not.toContain('Private note');
  });
  it('does not invent dates, papers or private values when the file is ambiguous',()=>{
    const result=normalizeDocument({format:'txt',tables:[{headers:['Name','Flat','Subscriptions'],rows:[{Name:'Anu',Flat:'001',Subscriptions:'UNKNOWN'}],source}],blocks:[],warnings:[]},'residents',catalog);
    expect(result.issues[0].message).toContain('newspaper');expect(result.rows[0]['Start Date']).toBeUndefined();
  });
});
