import {it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {extractFile} from './extract.js';
it('reads a synthetic English Hindi and Malayalam image locally with bundled models',async()=>{
 const document=await extractFile({buffer:await readFile(resolve('tests/fixtures/uploads/local-ocr.png')),filename:'synthetic.png'},{ocrEnabled:true,ocrDataPath:resolve('server/ocr-data'),ocrLanguages:['eng','hin','mal']});
 expect(document.tables[0].rows).toEqual([{Name:'Anu',Phone:'0012345678',Flat:'001'},{Name:'आशा',Phone:'0099999999',Flat:'002'},{Name:'അനു',Phone:'0088888888',Flat:'003'}]);
},60000);
