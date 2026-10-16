import { useEffect } from 'react';

const APP_NAME = 'Digima';

/** Sets "<page> · Digima" as the document title while the calling page is mounted. */
export function useDocumentTitle(page?: string) {
  useEffect(() => {
    document.title = page ? `${page} · ${APP_NAME}` : APP_NAME;
  }, [page]);
}
