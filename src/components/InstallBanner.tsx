import { useState } from 'react';
import { ShareIcon } from './icons';

const KEY = 'install-banner-dismissed';

/** Tells iPhone Safari users how to install the app; hidden once installed or dismissed. */
export default function InstallBanner() {
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = (navigator as any).standalone || matchMedia('(display-mode: standalone)').matches;
  const [hidden, setHidden] = useState(() => localStorage.getItem(KEY) === '1');

  if (!isIOS || standalone || hidden) return null;
  return (
    <div className="card mb-3 flex items-start gap-3 text-sm">
      <img src="apple-touch-icon.png" alt="" className="h-10 w-10 rounded-xl" />
      <div className="flex-1">
        <div className="font-semibold">Install the app</div>
        <div className="text-gray-600">
          Tap <ShareIcon className="inline h-4 w-4 -mt-1 text-blue-600" /> <b>Share</b>, then <b>Add to Home Screen</b> for a full-screen app.
        </div>
      </div>
      <button aria-label="Dismiss" className="px-2 text-xl leading-none text-gray-400"
        onClick={() => { localStorage.setItem(KEY, '1'); setHidden(true); }}>
        &times;
      </button>
    </div>
  );
}
