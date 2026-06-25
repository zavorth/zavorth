"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LANGUAGES, LOCALE_COOKIE, SYSTEM_LOCALE } from "@/i18n/config";
import type { Locale } from "@/i18n/config";
import { useLocale } from "next-intl";

/** Persist locale preference in cookie + localStorage (outside component scope for ESLint) */
function persistLocale(code: Locale | typeof SYSTEM_LOCALE) {
  document.cookie = `${LOCALE_COOKIE}=${code};path=/;max-age=${365 * 24 * 60 * 60};samesite=lax`;
  try {
    localStorage.setItem(LOCALE_COOKIE, code);
  } catch {
    // Ignore
  }
}

export default function LanguageSelector() {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preference, setPreference] = useState<string>(locale);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = preference === SYSTEM_LOCALE
    ? { code: SYSTEM_LOCALE, label: "AUTO", name: "System language", flag: "◎" }
    : LANGUAGES.find((l) => l.code === locale) || LANGUAGES[0];

  useEffect(() => {
    try {
      setPreference(localStorage.getItem(LOCALE_COOKIE) || locale);
    } catch {
      setPreference(locale);
    }
  }, [locale]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (code: Locale | typeof SYSTEM_LOCALE) => {
    if (code === preference) {
      setOpen(false);
      return;
    }

    persistLocale(code);
    setPreference(code);
    setOpen(false);
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-text-main hover:bg-surface-hover transition-all border border-transparent hover:border-border"
        title={currentLang.name}
      >
        <span className="text-base leading-none">{currentLang.flag}</span>
        <span className="text-xs font-semibold tracking-wide">{currentLang.label}</span>
        <span
          className={`material-symbols-outlined text-[14px] text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 max-h-80 rounded-xl border border-border bg-bg shadow-xl z-50 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          <button
            key={SYSTEM_LOCALE}
            onClick={() => handleSelect(SYSTEM_LOCALE)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
              preference === SYSTEM_LOCALE
                ? "bg-primary/10 text-primary font-semibold"
                : "text-text-main hover:bg-surface-hover"
            }`}
          >
            <span className="text-base leading-none">◎</span>
            <span className="flex-1 text-left">System language</span>
            {preference === SYSTEM_LOCALE && (
              <span className="material-symbols-outlined text-[16px] text-primary">check</span>
            )}
          </button>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                preference !== SYSTEM_LOCALE && lang.code === locale
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-text-main hover:bg-surface-hover"
              }`}
            >
              <span className="text-base leading-none">{lang.flag}</span>
              <span className="flex-1 text-left">{lang.name}</span>
              {preference !== SYSTEM_LOCALE && lang.code === locale && (
                <span className="material-symbols-outlined text-[16px] text-primary">check</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
