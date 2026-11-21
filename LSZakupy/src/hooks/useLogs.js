import { useEffect, useState } from 'react';
import { listenToLogs } from '../services/logsService';

export function useLogs(enabled = true) {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    if (!enabled) {
      setLogs([]);
      return;
    }

    let active = true;
    let unsubscribe;

    try {
      unsubscribe = listenToLogs((newLogs) => {
        if (active) {
          setLogs(Array.isArray(newLogs) ? newLogs : []);
        }
      });
    } catch (error) {
      console.error('Logs loading error:', error);

      if (active) {
        setLogs([]);
      }
    }

    return () => {
      active = false;

      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [enabled]);

  return logs;
}

export default useLogs;
