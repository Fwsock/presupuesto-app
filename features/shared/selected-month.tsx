import { createContext, useContext, useMemo, useState } from 'react';

interface SelectedMonthValue {
  year: number;
  month: number; // 1-12
  setMonth: (year: number, month: number) => void;
}

const SelectedMonthContext = createContext<SelectedMonthValue | null>(null);

/**
 * Holds the month the user is looking at, shared by Resumen and Movimientos so
 * navigating the month in one tab moves the other too (required by the design
 * spec: "comparte el mes con el resumen").
 */
export function SelectedMonthProvider({ children }: { children: React.ReactNode }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonthState] = useState(now.getMonth() + 1);

  const value = useMemo(
    () => ({
      year,
      month,
      setMonth: (y: number, m: number) => {
        setYear(y);
        setMonthState(m);
      },
    }),
    [year, month]
  );

  return <SelectedMonthContext.Provider value={value}>{children}</SelectedMonthContext.Provider>;
}

export function useSelectedMonth() {
  const ctx = useContext(SelectedMonthContext);
  if (!ctx) throw new Error('useSelectedMonth must be used within SelectedMonthProvider');
  return ctx;
}
