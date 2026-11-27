"use client";
import * as React from "react";
import { useTranslations } from "next-intl";
import { Download, Share, X } from "lucide-react";

export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !window.localStorage.getItem("hl_sw_dev")) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const DISMISS_KEY = "hl_install_dismissed";

function subscribeNoop() {
  return () => {};
}

export function InstallPrompt() {
  const t = useTranslations("driver.install");
  const [deferred, setDeferred] = React.useState<BIPEvent | null>(null);
  const [hidden, setHidden] = React.useState(false);

  const env = React.useSyncExternalStore(
    subscribeNoop,
    () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
      return `${standalone ? 1 : 0}${ios ? 1 : 0}${dismissed ? 1 : 0}`;
    },
    () => "100",
  );
  const [standalone, ios, dismissed] = env.split("").map((c) => c === "1");

  React.useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone || dismissed || hidden || (!deferred && !ios)) return null;

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  return (
    <div className="flex items-start gap-3 rounded-2xl bg-ink-900 p-4 text-white shadow-lg">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500">
        <Download className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{t("title")}</div>
        {ios && !deferred ? (
          <p className="mt-0.5 text-xs text-white/70">
            {t.rich("ios", { share: () => <Share className="inline h-3.5 w-3.5 align-text-bottom" /> })}
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-white/70">{t("body")}</p>
            <button
              type="button"
              className="mt-3 rounded-xl bg-lime-signal px-4 py-2 text-sm font-semibold text-ink-900"
              onClick={async () => {
                await deferred?.prompt();
                await deferred?.userChoice;
                setDeferred(null);
              }}
            >
              {t("cta")}
            </button>
          </>
        )}
      </div>
      <button type="button" onClick={dismiss} className="rounded-lg p-1 text-white/50 hover:text-white" aria-label={t("dismiss")}>
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
