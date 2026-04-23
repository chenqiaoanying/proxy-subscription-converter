import { ref, shallowRef } from 'vue'
import { createI18n } from 'vue-i18n'
import enLocale from 'element-plus/es/locale/lang/en'
import zhCnLocale from 'element-plus/es/locale/lang/zh-cn'
import type { Language as ElementLanguage } from 'element-plus/es/locale'
import en from './locales/en'
import zhCn from './locales/zh-cn'

export const SUPPORTED_LOCALES = ['en', 'zh-cn'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]

const STORAGE_KEY = 'locale'

function detectInitialLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
  if (stored && SUPPORTED_LOCALES.includes(stored)) return stored
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh')) {
    return 'zh-cn'
  }
  return 'en'
}

const initial = detectInitialLocale()

export const i18n = createI18n({
  legacy: false,
  locale: initial,
  fallbackLocale: 'en',
  messages: {
    'en': en,
    'zh-cn': zhCn,
  },
})

const ELEMENT_LOCALES: Record<Locale, ElementLanguage> = {
  'en': enLocale,
  'zh-cn': zhCnLocale,
}

export const currentLocale = ref<Locale>(initial)
export const elementLocale = shallowRef<ElementLanguage>(ELEMENT_LOCALES[initial])

export function setLocale(loc: Locale): void {
  if (!SUPPORTED_LOCALES.includes(loc)) return
  currentLocale.value = loc
  elementLocale.value = ELEMENT_LOCALES[loc]
  i18n.global.locale.value = loc
  localStorage.setItem(STORAGE_KEY, loc)
  document.documentElement.lang = loc
}

document.documentElement.lang = initial
