import { useCallback, useEffect, useState } from 'react';
import type { ProfileContent, User } from '../data/types';
import { emptyProfileContent } from '../context/ProfileContext';
import { ApiError } from '../lib/apiClient';
import { protectedRecordDenied, sameShownRecord } from '../lib/screenLoadingPresentation';
import { authApi, mapApiUserToUser } from '../services/authApi';

/**
 * Loads another user's public profile header from Nest (`GET /users/:id/public`).
 * Includes structured about sections when present on the API user.
 * Call `refresh` on screen focus so visitor sees latest cover/About after owner edits.
 * A refresh of the same person keeps the current header. A different person,
 * a denial, or a missing account clears it before the next paint.
 */
export function useVisitorUser(userId: string | undefined) {
  const [user, setUser] = useState<User | null>(null);
  const [about, setAbout] = useState<ProfileContent>(emptyProfileContent());
  const [loading, setLoading] = useState(Boolean(userId));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [shownFor, setShownFor] = useState<string | undefined>(userId);

  if (shownFor !== userId) {
    setShownFor(userId);
    setUser(null);
    setAbout(emptyProfileContent());
    setError(null);
    setRefreshing(false);
    setLoading(Boolean(userId));
  }

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const keepCurrent = sameShownRecord(user?.id, userId);
    if (keepCurrent) setRefreshing(true);
    else setLoading(true);
    setError(null);

    (async () => {
      try {
        const apiUser = await authApi.getById(userId);
        if (cancelled) return;
        setUser(mapApiUserToUser(apiUser));
        setAbout({
          ...emptyProfileContent(),
          bio: apiUser.bio ?? '',
          talents: apiUser.skills ?? [],
          languages: (apiUser.about?.languages ?? []).map((l) => ({
            ...l,
            flag: l.flag ?? '',
          })),
          education: apiUser.about?.education ?? [],
          experience: apiUser.about?.experience ?? [],
          certifications: apiUser.about?.certifications ?? [],
        });
      } catch (err) {
        if (cancelled) return;
        const denied =
          err instanceof ApiError && protectedRecordDenied(err.status);
        if (!keepCurrent || denied) {
          setUser(null);
          setAbout(emptyProfileContent());
        }
        setError(err instanceof Error ? err.message : 'Failed to load user');
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  return { user, about, loading, refreshing, error, refresh };
}
