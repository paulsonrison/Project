import ExcelJS from 'exceljs';
import { inflateRawSync } from 'node:zlib';
import { ApiError } from '../auth/scope.js';
export type ImportMode = 'add' | 'update' | 'remove' | 'replace';
export type ImportEntity = 'residents' | 'publications';
export interface ImportRecord { id: string; revision: number; [key: string]: unknown }
export interface WorkbookContext { id: string; entity: ImportEntity; mode: ImportMode; locale: string; records: ImportRecord[]; publications: ImportRecord[]; subscriptions: { residentId: string; publicationId: string; quantity: number }[] }
const customerHeaders = ['Sl. No.', 'Customer ID', 'Revision', 'Name', 'Number', 'Address/Flat', 'Address', 'Start Date', 'Remove?'];
const paperHeaders = ['Sl. No.', 'Newspaper ID', 'Revision', 'Name', 'Code', 'Edition/City', 'Amount (INR)', 'From Date', 'To Date (optional)', 'Schedule', 'Remove?'];
export function paperCode(paper: ImportRecord) { return String(paper.code || paper.id.slice(0, 8)).toUpperCase(); }
export async function buildWorkbook(context: WorkbookContext): Promise<Buffer> {
  const book = new ExcelJS.Workbook();
  const instructions = book.addWorksheet('Instructions');
  const language = context.locale.split('-')[0];
  const messages: Record<string, string[]> = {
    en: [
      'Fill this workbook, upload it, review every change, then save.',
      'Dates: YYYY-MM-DD. Quantities: 1 = one copy. Update: blank = unchanged, 0 = stop from Start Date.',
      `Mode: ${context.mode}. Entity: ${context.entity}.`,
      'Remove?: only Yes explicitly archives a record. Omitted rows never remove records in Update.',
      'Replace: this exported selection is the complete scope. Mark Yes to remove; missing exported IDs are an error.',
      'Keep IDs and Revision unchanged. Shared phone numbers are allowed. Do not enter formulas.',
      'From Date required for a new rate. To Date is inclusive; blank means until changed.',
      'Replace and removal retain historical deliveries and invoices.',
      'Example customer: Anu | +919000000001 | B-12 | Subscription MM: 1. Examples are not imported.',
      'Rates sheet is reference history. In Data, enter Amount and From Date only when scheduling a new rate. Blank price cells leave rates unchanged.',
    ],
    hi: [
      'एक्सेल भरें और अपलोड करें। हर बदलाव जाँचने के बाद सहेजें।',
      'तारीख YYYY-MM-DD। संख्या: 1 = एक प्रति। Update में खाली = कोई बदलाव नहीं, 0 = Start Date से बंद करें।',
      `काम (Mode): ${{add:'नया जोड़ें',update:'मौजूदा बदलें',remove:'चुने हुए हटाएँ',replace:'चुना गया समूह बदलें'}[context.mode]}. जानकारी: ${context.entity==='residents'?'ग्राहक':'समाचार पत्र'}।`,
      'Remove? कॉलम में केवल Yes लिखने से रिकॉर्ड संग्रहित होगा। Update में छोड़ी गई पंक्तियाँ कभी रिकॉर्ड नहीं हटातीं।',
      'Replace में निर्यात किए गए पूरे समूह का मिलान होगा। हटाने के लिए Yes लिखें; निर्यात किया गया कोई ID गायब हो तो त्रुटि आएगी।',
      'ID और Revision न बदलें। एक फ़ोन नंबर कई ग्राहकों का हो सकता है। फ़ॉर्मूले न डालें।',
      'नई दर के लिए From Date आवश्यक है। To Date की अंतिम तारीख भी शामिल है; खाली छोड़ने पर अगले बदलाव तक लागू रहेगी।',
      'Replace और हटाने पर पुराने वितरण और बिल सुरक्षित रहते हैं।',
      'केवल उदाहरण: Anu | +919000000001 | B-12 | Subscription MM: 1. उदाहरण आयात नहीं किए जाते।',
      'Rates शीट केवल पुरानी दरों की जानकारी है। Data में Amount और From Date केवल नई दर तय करते समय भरें। दर वाले खाली खाने का अर्थ कोई बदलाव नहीं है।',
    ],
    ml: [
      'എക്സൽ പൂരിപ്പിച്ച് അപ്‌ലോഡ് ചെയ്യുക. ഓരോ മാറ്റവും പരിശോധിച്ച ശേഷം സേവ് ചെയ്യുക.',
      'തീയതി YYYY-MM-DD. എണ്ണം: 1 = ഒരു കോപ്പി. Update-ൽ ശൂന്യം = മാറ്റമില്ല; 0 = Start Date മുതൽ നിർത്തുക.',
      `പ്രവർത്തനം (Mode): ${{add:'പുതിയത് ചേർക്കുക',update:'നിലവിലുള്ളത് പുതുക്കുക',remove:'തിരഞ്ഞെടുത്തവ നീക്കുക',replace:'തിരഞ്ഞെടുത്ത കൂട്ടം മാറ്റിസ്ഥാപിക്കുക'}[context.mode]}. വിവരങ്ങൾ: ${context.entity==='residents'?'ഉപഭോക്താക്കൾ':'പത്രങ്ങൾ'}.`,
      'Remove? കോളത്തിൽ Yes നൽകിയവ മാത്രം നിഷ്ക്രിയമാക്കും. Update-ൽ വിട്ടുപോയ വരികൾ നിലവിലെ വിവരങ്ങൾ നീക്കില്ല.',
      'Replace-ൽ ഡൗൺലോഡ് ചെയ്ത മുഴുവൻ കൂട്ടവും പരിശോധിക്കും. നീക്കേണ്ടവയ്ക്ക് Yes നൽകുക. ഡൗൺലോഡ് ചെയ്ത ID ഇല്ലാതായാൽ പിശക് കാണിക്കും.',
      'ID-യും Revision-ഉം മാറ്റരുത്. ഒരേ ഫോൺ നമ്പർ പലർക്കും ഉപയോഗിക്കാം. ഫോർമുലകൾ നൽകരുത്.',
      'പുതിയ നിരക്കിന് From Date നിർബന്ധമാണ്. To Date-ലെ അവസാന തീയതി ഉൾപ്പെടും. ശൂന്യമായാൽ അടുത്ത മാറ്റം വരെ തുടരും.',
      'Replace ചെയ്താലും നീക്കിയാലും മുൻ വിതരണ വിവരങ്ങളും ബില്ലുകളും സൂക്ഷിക്കും.',
      'ഉദാഹരണം മാത്രം: Anu | +919000000001 | B-12 | Subscription MM: 1. ഉദാഹരണങ്ങൾ ഇംപോർട്ട് ചെയ്യില്ല.',
      'Rates ഷീറ്റ് മുൻനിരക്കുകളുടെ വിവരം മാത്രമാണ്. പുതിയ നിരക്ക് നിശ്ചയിക്കുമ്പോൾ മാത്രം Data-യിൽ Amount-ഉം From Date-ഉം നൽകുക. നിരക്ക് സെല്ലുകൾ ശൂന്യമായാൽ മാറ്റമില്ല.',
    ],
  };
  const instructionRows = messages[language] ?? messages.en;
  instructionRows.slice(0, 9).forEach(message => instructions.addRow([message]));
  instructions.getColumn(1).width = 110;
  const meta = book.addWorksheet('_Template'); meta.addRow(['version', '1']); meta.addRow(['id', context.id]); meta.state = 'veryHidden';
  const data = book.addWorksheet('Data', { views: [{ state: 'frozen', ySplit: 1 }] });
  const headers = context.entity === 'residents' ? [...customerHeaders, ...context.publications.map(p => `Subscription: ${paperCode(p)}`)] : paperHeaders;
  data.addRow(headers); data.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; data.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF222222' } };
  if (context.mode !== 'add') context.records.forEach((record, n) => {
    const values = context.entity === 'residents' ? [n + 1, record.id, record.revision, record.name, record.phone, record.unit, record.address, '', 'No', ...context.publications.map(p => context.subscriptions.filter(s => s.residentId === record.id && s.publicationId === p.id).reduce((v,s) => v+s.quantity, 0) || '')] : [n + 1, record.id, record.revision, record.name, paperCode(record), record.edition || '', '', '', '', record.schedule, 'No'];
    data.addRow(values.map(value => value === undefined ? '' : value as ExcelJS.CellValue));
  });
  data.columns.forEach((column, i) => { column.width = i === 3 ? 28 : 22; column.numFmt = '@'; });
  for (let n = 2; n <= Math.min(5001, Math.max(context.records.length + 1, 100)); n++) {
    data.getCell(n, context.entity === 'residents' ? 9 : 11).dataValidation = { type: 'list', allowBlank: true, formulae: ['"No,Yes"'], showErrorMessage: true };
  }
  const papers = book.addWorksheet('Newspapers'); papers.addRow(['Code', 'Name', 'Edition/City', 'ID']); context.publications.forEach(p => papers.addRow([paperCode(p), String(p.name), String(p.edition || ''), p.id])); papers.columns.forEach(c => { c.width = 30; c.numFmt = '@'; });
  if(context.entity==='publications') {
    const rates=book.addWorksheet('Rates');rates.addRow(['Code','Newspaper','From Date','Until (exclusive)','Amount (INR)','Source']);
    for(const p of context.records) {
      const intervals=(p.rateIntervals as {validFrom:string;validToExclusive?:string;price:number;source?:string}[]|undefined);
      const history=(p.priceHistory as {effectiveDate:string;price:number}[]|undefined);
      if(intervals?.length)for(const r of intervals)rates.addRow([paperCode(p),String(p.name),r.validFrom,r.validToExclusive||'',r.price/100,r.source||'Rate history']);
      else if(history?.length)for(const r of history)rates.addRow([paperCode(p),String(p.name),r.effectiveDate,'',r.price/100,'Legacy effective price']);
      else rates.addRow([paperCode(p),String(p.name),'Unknown','',Number(p.basePrice)/100,'Legacy base price; confirm historical start date']);
    }
    rates.columns.forEach(c=>c.width=28);
    instructions.addRow([instructionRows[9]]);
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}
export function checkZip(buffer: Buffer,inspect?:(name:string,contents:Buffer)=>void) {
  if (buffer.length > 10 * 1024 * 1024 || buffer.readUInt32LE(0) !== 0x04034b50) throw new ApiError(400, 'Upload an .xlsx workbook smaller than 10 MB');
  const invalid=()=>new ApiError(400,'Invalid or unsupported workbook archive');
  // Read the actual central directory rather than scanning payload bytes for signatures.
  let end=-1;
  for(let i=buffer.length-22;i>=Math.max(0,buffer.length-65557);i--)if(buffer.readUInt32LE(i)===0x06054b50&&i+22+buffer.readUInt16LE(i+20)===buffer.length){end=i;break;}
  if(end<0)throw invalid();
  const count=buffer.readUInt16LE(end+10),directorySize=buffer.readUInt32LE(end+12),directoryStart=buffer.readUInt32LE(end+16);
  if(buffer.readUInt16LE(end+4)||buffer.readUInt16LE(end+6)||count!==buffer.readUInt16LE(end+8)||count===0||count>200||directoryStart+directorySize!==end)throw invalid();
  let cursor=directoryStart,total=0;const names=new Set<string>(),segments:{start:number;end:number}[]=[];
  for(let n=0;n<count;n++){
    if(cursor+46>end||buffer.readUInt32LE(cursor)!==0x02014b50)throw invalid();
    const flags=buffer.readUInt16LE(cursor+8),method=buffer.readUInt16LE(cursor+10),compressed=buffer.readUInt32LE(cursor+20),expanded=buffer.readUInt32LE(cursor+24),nameLength=buffer.readUInt16LE(cursor+28),extraLength=buffer.readUInt16LE(cursor+30),commentLength=buffer.readUInt16LE(cursor+32),local=buffer.readUInt32LE(cursor+42);
    if(cursor+46+nameLength+extraLength+commentLength>end||flags&1||![0,8].includes(method)||compressed===0xffffffff||expanded===0xffffffff)throw invalid();
    const name=buffer.subarray(cursor+46,cursor+46+nameLength).toString('utf8');
    if(names.has(name)||name.includes('..')||name.startsWith('/')||name.includes('\\'))throw invalid();names.add(name);
    if(/vbaProject|externalLinks/i.test(name))throw new ApiError(400,'Macros and external workbook links are not supported');
    total+=expanded;if(total>50*1024*1024)throw new ApiError(400,'Workbook expanded contents exceed the limit');
    if(local+30>directoryStart||buffer.readUInt32LE(local)!==0x04034b50)throw invalid();
    const start=local+30+buffer.readUInt16LE(local+26)+buffer.readUInt16LE(local+28),finish=start+compressed;
    if(finish>directoryStart||buffer.readUInt16LE(local+8)!==method||buffer.readUInt16LE(local+6)&1)throw invalid();
    if(segments.some(s=>local<s.end&&finish>s.start))throw invalid();segments.push({start:local,end:finish});
    // A malicious ZIP can lie about its expanded size. Enforce an actual inflation bound
    // before handing the workbook to ExcelJS, which otherwise inflates without this cap.
    try {
      const raw=buffer.subarray(start,finish),contents=method===0?raw:inflateRawSync(raw,{maxOutputLength:Math.max(1,expanded)});
      if(contents.length!==expanded)throw invalid();
      inspect?.(name,contents);
    }catch(error){if(error instanceof ApiError)throw error;throw invalid();}
    cursor+=46+nameLength+extraLength+commentLength;
  }
  if(cursor!==end)throw invalid();
}
export async function parseWorkbook(buffer: Buffer): Promise<{ templateId?: string; headers: string[]; rows: Record<string, string>[] }> {
  if (buffer.length < 50) throw new ApiError(400, 'Invalid workbook'); checkZip(buffer);
  const book = new ExcelJS.Workbook();
  try { await book.xlsx.load(buffer as unknown as Parameters<typeof book.xlsx.load>[0]); } catch { throw new ApiError(400, 'Cannot read this workbook. Upload an unlocked .xlsx file.'); }
  const data = book.getWorksheet('Data') || book.worksheets.find(w => !['Instructions', 'Newspapers', '_Template','Rates'].includes(w.name));
  if (!data || data.rowCount > 5001 || data.columnCount > 200) throw new ApiError(400, 'Workbook must have at most 5,000 rows and 200 columns');
  const text = (cell: ExcelJS.Cell) => {
    const value = cell.value;
    if (value && typeof value === 'object' && ('formula' in value || 'sharedFormula' in value || 'hyperlink' in value)) throw new ApiError(400, `Formula or link in ${cell.address}: enter a plain value`);
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return cell.text.trim();
  };
  const headers: string[] = []; for(let n=1;n<=data.columnCount;n++){const label=text(data.getRow(1).getCell(n));if(!label||headers.includes(label))throw new ApiError(400,'Every column must have a unique header');headers.push(label);}
  const rows: Record<string, string>[] = [];
  data.eachRow((row, n) => { if (n === 1) return; const record: Record<string, string> = {}; headers.forEach((h, i) => record[h] = text(row.getCell(i + 1))); if (Object.entries(record).some(([key, value]) => value && key !== 'Remove?')) rows.push(record); });
  const meta = book.getWorksheet('_Template');
  return { templateId: meta?.getCell('B2').text || undefined, headers, rows };
}
