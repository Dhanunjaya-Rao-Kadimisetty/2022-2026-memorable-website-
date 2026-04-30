'use client';

import { useEffect, useId, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        },
      ) => string;
      reset: (widgetId: string) => void;
    };
  }
}

type TurnstileWidgetProps = {
  siteKey: string;
  onToken: (token: string) => void;
  onReset?: () => void;
};

export default function TurnstileWidget({ siteKey, onToken, onReset }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const elementId = useId();

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;

    const renderWidget = () => {
      if (!window.turnstile || !containerRef.current || widgetIdRef.current) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'auto',
        callback: (token) => onToken(token),
        'expired-callback': () => {
          onToken('');
          onReset?.();
        },
        'error-callback': () => {
          onToken('');
          onReset?.();
        },
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-turnstile="true"]');
    if (window.turnstile) {
      renderWidget();
      return;
    }

    if (existingScript) {
      existingScript.addEventListener('load', renderWidget, { once: true });
      return () => {
        existingScript.removeEventListener('load', renderWidget);
      };
    }

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstile = 'true';
    script.addEventListener('load', renderWidget, { once: true });
    document.head.appendChild(script);

    return () => {
      script.removeEventListener('load', renderWidget);
    };
  }, [onReset, onToken, siteKey]);

  useEffect(() => {
    return () => {
      widgetIdRef.current = null;
    };
  }, []);

  return <div id={elementId} ref={containerRef} />;
}

