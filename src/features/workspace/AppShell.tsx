import { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { api, save, type Session } from '../../services/api';
import { AccountContext } from './context';
import { useI18n } from '../../i18n/index';
import LanguageSwitcher from '../../components/common/LanguageSwitcher';
import { ownerNavigation, navigationForPath } from './navigation';
import FirstUseSetup from '../settings/FirstUseSetup';
export default function AppShell() {
  const { t, locale, setAccount } = useI18n();
  const [session, setSession] = useState<Session | null>(null), [loaded, setLoaded] = useState(false), [open, setOpen] = useState(false);
  const navigate = useNavigate(), location = useLocation();
  useEffect(() => { setAccount(session?.userId ?? null); }, [session?.userId, setAccount]);
  useEffect(() => { api<Session>('/auth/session').then(setSession).catch(() => setSession(null)).finally(() => setLoaded(true)); }, [location.pathname]);
  if (!loaded) return <div className="loading-page"><strong>PRESS<span>TRACK</span></strong><p>{t("Opening your newspaper desk…")}</p></div>;
  if (!session) return <Navigate to="/signin" replace />;
  const group = navigationForPath(location.pathname);
  const links = session.role === 'admin' ? ownerNavigation : session.role === 'resident' ? [
    {path:'/residents',label:'My account',icon:'♙'}, {path:'/calendar',label:'My deliveries',icon:'▦'}, {path:'/billing',label:'My bills',icon:'▱'}, {path:'/payments',label:'Payments',icon:'₹'}, {path:'/pauses',label:'Holiday pauses',icon:'Ⅱ'}, {path:'/complaints',label:'Delivery concerns',icon:'!'}, {path:'/chat',label:'Account assistant',icon:'✳'}
  ] : [{path:'/today',label:'My delivery round',icon:'↗'},{path:'/chat',label:'Account assistant',icon:'✳'}];
  const title = session.role === 'admin' ? group.primary.label : links.find(link=>link.path===location.pathname)?.label ?? 'Today';
  return <AccountContext.Provider value={session}><div className="workspace">
    <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label={t('Main navigation')}>
      <button className="sidebar-close" aria-label={t('Close navigation menu')} onClick={()=>setOpen(false)}>×</button>
      <Link className="brand" to="/today">PRESS<span>TRACK</span></Link>
      <div className="society-label"><strong>{session.society.name}</strong></div>
      <nav>{links.map(link=>{const active=session.role==='admin'?group.primary.path===link.path:location.pathname===link.path;return <Link key={link.path} to={link.path} className={active?'active':undefined} aria-current={active?'page':undefined} onClick={()=>setOpen(false)}><span aria-hidden="true">{link.icon}</span>{t(link.label)}</Link>;})}</nav>
      <div className="sidebar-bottom"><span className="avatar">{session.name.slice(0,1)}</span><div><strong>{session.name}</strong><small>{t(session.role==='admin'?'Owner':session.role)}</small></div><button aria-label={t('Sign out')} onClick={async()=>{await save('/auth/logout',{});setSession(null);navigate('/signin');}}>↪</button></div>
    </aside>
    {open&&<button aria-label={t('Close navigation')} className="nav-backdrop" onClick={()=>setOpen(false)}/>}
    <div className="workspace-main"><header className="workspace-header">
      <button className="mobile-toggle" aria-label={t('Toggle navigation')} aria-expanded={open} onClick={()=>setOpen(!open)}>☰</button>
      <span className="header-title">{t(title)}</span>
      <div className="header-actions"><time className="header-date mono">{new Date().toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric',timeZone:session.society.timezone})}</time><LanguageSwitcher/></div>
    </header><main id="main" className="workspace-content">
      {session.role==='admin'&&<nav className="page-tabs" aria-label={t('Page sections')}>{group.tabs.map(tab=><Link key={tab.path} to={tab.path} aria-current={location.pathname===tab.path?'page':undefined}>{t(tab.label)}</Link>)}</nav>}
      <Outlet/>
    </main></div>
  </div>{session.role==='admin'&&<FirstUseSetup/>}</AccountContext.Provider>;
}
