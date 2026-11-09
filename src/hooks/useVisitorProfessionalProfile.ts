import { useEffect, useState } from 'react';
import { PortfolioProject, ServiceOffering } from '../data/types';
import {
  mapPortfolioProject,
  portfolioApi,
} from '../services/portfolioApi';
import {
  mapServiceOffering,
  servicesApi,
} from '../services/servicesApi';

/**
 * Loads another user's portfolio + services from Nest (visitor profile).
 * Returns empty lists when the user has no Nest-backed data.
 */
export function useVisitorProfessionalProfile(userId: string | undefined) {
  const [portfolio, setPortfolio] = useState<PortfolioProject[]>([]);
  const [services, setServices] = useState<ServiceOffering[]>([]);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState(userId);

  if (shownFor !== userId) {
    setShownFor(userId);
    setPortfolio([]);
    setServices([]);
    setError(null);
    setLoading(Boolean(userId));
  }

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [p, s] = await Promise.all([
          portfolioApi.listForUser(userId),
          servicesApi.listForUser(userId),
        ]);
        if (cancelled) return;
        setPortfolio(p.map(mapPortfolioProject));
        setServices(s.map(mapServiceOffering));
      } catch (err) {
        if (cancelled) return;
        setPortfolio([]);
        setServices([]);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { portfolio, services, loading, error };
}
