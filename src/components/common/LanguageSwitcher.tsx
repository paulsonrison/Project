import { useI18n, type Locale } from '../../i18n';

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return <label className="language-switcher"><span>{t('Language')}</span><select aria-label={t('Language')} value={locale} onChange={event => setLocale(event.target.value as Locale)}>
    <option value="en-IN" lang="en">English</option><option value="hi-IN" lang="hi">हिन्दी</option><option value="ml-IN" lang="ml">മലയാളം</option>
  </select></label>;
}
