import {z} from 'zod';
import type {Config} from '../config/env.js';
import type {NormalizedUpload} from './normalize.js';
import {publicStructure} from './normalize.js';
export async function interpretStructure(config:Config,upload:NormalizedUpload):Promise<{aiUsed:boolean;notice?:string}> {
  if(!config.groqKey)return {aiUsed:false,notice:'AI is unavailable. Check the extracted details before saving.'};
  // Customer values and source text have no path into this payload.
  const safe=publicStructure(upload);
  try{
    const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${config.groqKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(20000),body:JSON.stringify({model:config.groqModel,temperature:0,max_completion_tokens:200,response_format:{type:'json_object'},messages:[{role:'system',content:'Check the structure of a newspaper customer/catalog import. Only canonical field names and counts are provided, never customer values. Return JSON {"recognized":boolean}. Do not infer any missing values, ask for private information, or perform writes.'},{role:'user',content:JSON.stringify(safe)}]})});
    if(!response.ok)return {aiUsed:false,notice:'AI could not check this file. Review the extracted details.'};
    const result=await response.json() as {choices?:{message?:{content?:string}}[]};
    const content=result.choices?.[0]?.message?.content||'';
    const parsed=z.object({recognized:z.boolean()}).strict().parse(JSON.parse(content));
    return {aiUsed:true,...(!parsed.recognized?{notice:'Some columns need checking before saving.'}:{})};
  }catch{return {aiUsed:false,notice:'AI could not check this file. Review the extracted details.'};}
}
