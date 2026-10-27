import {describe,expect,it} from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {extractFile} from './extract.js';
import {imageDimensions} from './extractors/image.js';

function textFile(text:string,filename='customers.csv'){return {buffer:Buffer.from(text),filename};}
function pdfFixture(stream:string,pages=1){
  const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${Array.from({length:pages},(_,i)=>`${3+i} 0 R`).join(' ')}] /Count ${pages} >>`,...Array.from({length:pages},()=>`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${3+pages} 0 R >> >> /Contents ${4+pages} 0 R >>`),'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
  let data='%PDF-1.7\n';const offsets=[0];objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${object}\nendobj\n`;});const xref=Buffer.byteLength(data);data+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,'0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(data);
}
describe('bounded local file extraction',()=>{
  it('preserves quoted fields, newlines, zero-prefixed phones and multilingual names in CSV',async()=>{
    const result=await extractFile(textFile('\ufeffName,Phone,Flat,Address\r\n"അനു",0012345678,001,"First line\nSecond line"\r\n"आशा",0099999999,002,"Kochi, Kerala"'));
    expect(result.format).toBe('csv');expect(result.tables[0].rows).toEqual([{Name:'അനു',Phone:'0012345678',Flat:'001',Address:'First line\nSecond line'},{Name:'आशा',Phone:'0099999999',Flat:'002',Address:'Kochi, Kerala'}]);
  });
  it('detects tab-separated and plain text without inventing records for prose',async()=>{
    const tsv=await extractFile(textFile('Name\tFlat\nAnu\t001','customers.tsv'));
    expect(tsv.tables[0].rows[0]).toEqual({Name:'Anu',Flat:'001'});
    const prose=await extractFile(textFile('Customer notes\nPlease check tomorrow.','notes.txt'));
    expect(prose.tables).toEqual([]);expect(prose.blocks[0].text).toContain('Please check tomorrow.');
  });
  it('recognizes labelled single-record notes and aligned OCR-like text locally',async()=>{
    expect((await extractFile(textFile('Name: Anu\nPhone: 0012345678\nFlat: 001','note.txt'))).tables[0].rows[0]).toEqual({Name:'Anu',Phone:'0012345678',Flat:'001'});
    expect((await extractFile(textFile('Name     Flat\nAnu      001','scan-text.txt'))).tables[0].rows[0]).toEqual({Name:'Anu',Flat:'001'});
  });
  it('reads multiple workbook tables and rejects formulas and too many cells',async()=>{
    const book=new ExcelJS.Workbook();book.addWorksheet('A').addRows([['Name','Flat'],['Anu','001']]);book.addWorksheet('B').addRows([['Name','Flat'],['Binu','002']]);
    const file={buffer:Buffer.from(await book.xlsx.writeBuffer()),filename:'customers.xlsx'};
    expect((await extractFile(file)).tables).toHaveLength(2);
    await expect(extractFile(file,{limits:{maxCells:3}})).rejects.toThrow(/limit|cells/i);
    book.getWorksheet('A')!.getCell('A2').value={formula:'1+1',result:2};
    await expect(extractFile({...file,buffer:Buffer.from(await book.xlsx.writeBuffer())})).rejects.toThrow(/formula/i);
  });
  it('extracts DOCX paragraphs locally and keeps source information',async()=>{
    const zip=new JSZip();zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Private Customer 001</w:t></w:r></w:p></w:body></w:document>');
    const result=await extractFile({buffer:await zip.generateAsync({type:'nodebuffer'}),filename:'customers.docx'});
    expect(result.blocks[0]).toMatchObject({text:expect.stringContaining('Private Customer 001'),source:{filename:'customers.docx'}});
  });
  it('extracts positioned PDF tables and rejects too many pages before rasterization',async()=>{
    const buffer=pdfFixture('BT /F1 12 Tf 50 750 Td (Name) Tj 150 0 Td (Flat) Tj -150 -24 Td (Anu) Tj 150 0 Td (001) Tj ET');
    const result=await extractFile({buffer,filename:'customers.pdf'});
    expect(result.tables[0].rows[0]).toEqual({Name:'Anu',Flat:'001'});expect(result.tables[0].source.page).toBe(1);
    await expect(extractFile({buffer:pdfFixture('',21),filename:'large.pdf'})).rejects.toThrow(/20 text pages|too many pages/);
  });
  it('rejects disabled scan OCR and unsafe decoded dimensions before image loading',async()=>{
    await expect(extractFile({buffer:pdfFixture(''),filename:'scan.pdf'})).rejects.toThrow(/scanned pages|not enabled/);
    const png=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(png);png.writeUInt32BE(100000,16);png.writeUInt32BE(100000,20);
    expect(imageDimensions(png)).toEqual({width:100000,height:100000});await expect(extractFile({buffer:png,filename:'huge.png'},{ocrEnabled:true})).rejects.toThrow(/pixel limit/);
  });
  it('rejects unsupported, disguised, encrypted-looking, invalid and oversized inputs usefully',async()=>{
    await expect(extractFile(textFile('hello','archive.zip'))).rejects.toThrow(/supported|format/i);
    await expect(extractFile(textFile('not a PDF','customers.pdf'))).rejects.toThrow(/match|PDF|format/i);
    await expect(extractFile({buffer:Buffer.alloc(11*1024*1024),filename:'large.txt'})).rejects.toThrow(/10 MB|size|limit/i);
    await expect(extractFile({buffer:Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]),filename:'customers.xlsx'})).rejects.toThrow(/unlock|encrypt|match|format/i);
  });
  it('does not send scans to a provider or load OCR without an explicit resource gate',async()=>{
    const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=','base64');
    await expect(extractFile({buffer:png,filename:'scan.png'})).rejects.toThrow(/scan|OCR|enabled|image/i);
  });
});
