import type {ExtractedDocument,SourceReference} from './types.js';
export interface CatalogPaper {id:string;code:string;name:string}
export interface NormalizedUpload {rows:Record<string,string>[];issues:{row:number;message:string}[];unmapped:string[];sources:SourceReference[];columns:string[]}
const aliases:Record<string,string[]>={
  Name:['name','full name','customer','customer name','resident','resident name','publication','publication name','newspaper','newspaper name','പേര്','ഉപഭോക്താവ്','नाम','पूरा नाम','ग्राहक'],
  Number:['number','phone','mobile','mobile number','phone number','contact','contact number','ഫോൺ','ഫോണ്','മൊബൈൽ','फोन','मोबाइल','नंबर'],
  'Address/Flat':['flat','flat no','flat number','unit','apartment','address/flat','door no','house no','फ्लैट','मकान','ഫ്ലാറ്റ്','വീട്'],
  Address:['address','street address','delivery address','വിലാസം','पता'],
  'Start Date':['start date','starts','start','first delivery date','delivery from','ആരംഭ തീയതി','തുടക്കം','शुरू तारीख'],
  'From Date':['from date','valid from','effective date','price effective from','നിരക്ക് മുതൽ','प्रभावी तारीख'],
  'To Date (optional)':['to date','to date optional','valid to','until','end date','അവസാന തീയതി','अंतिम तारीख'],
  Code:['code','paper code','newspaper code','ചുരുക്കം','കോഡ്','कोड'],
  'Edition/City':['edition','city','edition/city','പതിപ്പ്','संस्करण'],
  'Amount (INR)':['amount','amount inr','price','rate','daily rate','price per issue','നിരക്ക്','വില','दर','कीमत'],
  Schedule:['schedule','delivery schedule','frequency','ക്രമം','आवृत्ति'],
  'Customer ID':['customer id','resident id'], 'Newspaper ID':['newspaper id','publication id'], Revision:['revision'], 'Remove?':['remove','remove?'],
};
const fold=(value:string)=>value.toLowerCase().trim().replace(/[._:()?-]/g,' ').replace(/\s+/g,' ').trim();
const aliasLookup=new Map(Object.entries(aliases).flatMap(([target,words])=>words.map(word=>[fold(word),target] as const)));
const discarded=new Set(['sl no','s no','si no','serial','serial number','no','sr no']);
function paperFor(value:string,papers:CatalogPaper[]){return papers.find(p=>fold(p.code)===fold(value)||fold(p.name)===fold(value));}
export function normalizeDocument(document:ExtractedDocument,entity:'residents'|'publications',papers:CatalogPaper[]):NormalizedUpload {
  const result:NormalizedUpload={rows:[],issues:[],unmapped:[],sources:[],columns:[]};
  for(const table of document.tables)for(const [index,input]of table.rows.entries()){
    const row:Record<string,string>={},number=result.rows.length+1;
    for(const header of table.headers){
      const value=String(input[header]??'').trim();
      if(discarded.has(fold(header)))continue;
      let target=aliasLookup.get(fold(header));
      const subscriptionHeader=header.match(/^subscriptions?\s*[:-]\s*(.+)$/i);
      const paper=entity==='residents'?paperFor(subscriptionHeader?.[1]||header,papers):undefined;
      if(paper)target=`Subscription: ${paper.code}`;
      if(!target&&entity==='residents'&&/^(subscriptions?|papers?|newspapers?|പത്രങ്ങൾ|പത്രം|समाचार पत्र)$/i.test(header.trim())){
        if(value)for(const choice of value.split(/[,;\n]+/).map(v=>v.trim()).filter(Boolean)){
          const quantityMatch=choice.match(/^(.+?)\s*(?:[:x×]\s*(\d+))?$/i),selected=quantityMatch&&paperFor(quantityMatch[1],papers);
          if(!selected){result.issues.push({row:number,message:'Choose an existing newspaper for this row.'});continue;}
          row[`Subscription: ${selected.code}`]=quantityMatch?.[2]||'1';
        }
        continue;
      }
      if(!target){if(!result.unmapped.includes(header))result.unmapped.push(header);continue;}
      if(entity==='publications'&&target==='Start Date')target='From Date';
      if(entity==='residents'&&target==='From Date')target='Start Date';
      if(Object.hasOwn(row,target)&&row[target]!==value){result.issues.push({row:number,message:`Two columns contain different values for ${target}.`});continue;}
      if(target==='Amount (INR)')row[target]=value.replace(/^(?:INR|Rs\.?|₹)\s*/i,'').replace(/,/g,'');
      else if(target.startsWith('Subscription: '))row[target]=/^(yes|y|true|അതെ|हाँ)$/i.test(value)?'1':/^(no|n|false|ഇല്ല|नहीं)$/i.test(value)?'0':value;
      else row[target]=value;
    }
    if(Object.values(row).some(Boolean)){result.rows.push(row);result.sources.push(table.rowSources?.[index]||{...table.source,row:index+2});}
  }
  if(!result.rows.length)result.issues.push({row:0,message:'We could not find records. Use a clear table with Name and Flat columns.'});
  result.columns=[...new Set(result.rows.flatMap(row=>Object.keys(row)))];return result;
}
// Never forward source headers, filenames, cell values, IDs or private tokens.
// Only canonical field labels and structural counts are provider-readable.
export function publicStructure(result:NormalizedUpload){
  return {fields:result.columns.filter(name=>Object.hasOwn(aliases,name)||name.startsWith('Subscription: ')).map(name=>name.startsWith('Subscription: ')?'Newspaper quantity':name),rowCount:result.rows.length,unmatchedColumnCount:result.unmapped.length};
}
