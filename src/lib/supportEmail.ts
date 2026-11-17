export const SUPPORT_EMAIL = 'support@mawahib.io';
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

export type SupportOpenResult = 'opened' | 'unavailable';
export type SupportCopyResult = 'copied' | 'copy-failed';

/**
 * Opens only the support address. A device without an email app rejects the
 * URL; that rejection is a result, not a deletion action.
 */
export async function openSupportEmail(deps: {
  openURL: (url: string) => Promise<unknown>;
}): Promise<SupportOpenResult> {
  try {
    await deps.openURL(SUPPORT_MAILTO);
    return 'opened';
  } catch {
    return 'unavailable';
  }
}

/** Copies only the support address. A false result or a throw stays a result. */
export async function copySupportEmail(deps: {
  setString: (value: string) => Promise<unknown> | unknown;
}): Promise<SupportCopyResult> {
  try {
    const result = await deps.setString(SUPPORT_EMAIL);
    if (result === false) return 'copy-failed';
    return 'copied';
  } catch {
    return 'copy-failed';
  }
}
