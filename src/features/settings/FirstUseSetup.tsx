import { useEffect,useState } from 'react';
import Dialog from '../../components/common/Dialog';
import { api } from '../../services/api';
import { useI18n } from '../../i18n';
import { useAccount } from '../workspace/context';
import PreferencesPanel,{type Preferences} from './PreferencesPanel';
export default function FirstUseSetup({onComplete}:{onComplete?:()=>void}){
  const account=useAccount(),{t}=useI18n();const [needed,setNeeded]=useState(false),[dismissed,setDismissed]=useState(false);
  useEffect(()=>{if(account.role!=='admin')return;const controller=new AbortController();api<Preferences>('/preferences',{signal:controller.signal}).then(data=>setNeeded(data.onboardingVersion<1)).catch(()=>{if(!controller.signal.aborted)setNeeded(true);});return()=>controller.abort();},[account.userId,account.role]);
  if(!needed||dismissed)return null;
  return <Dialog title={t('Set up your business')} onClose={()=>setDismissed(true)}><PreferencesPanel onboarding onSaved={()=>{setNeeded(false);onComplete?.();}}/></Dialog>;
}
