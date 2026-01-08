
import type { Client } from '../types';

export const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; 
  }
  return String(hash);
};

export const getMonthName = (monthIndex: number) => `${monthIndex + 1}월`;

export const MONTHS = Array.from({ length: 12 }, (_, i) => i);

export const DOC_TYPES = {
    schedule: "일정표",
    weeklyReport: "주간업무보고",
    retroactivePayment: "소급결제"
};

/**
 * Generates a unique key for submission data based on client, year, and month.
 * Format: `${clientId}-${year}-${monthIndex}`
 */
export const getSubmissionKey = (clientId: string, year: number, monthIndex: number): string => {
    return `${clientId}-${year}-${monthIndex}`;
};

export const normalizeDob = (dobInput: any): string => {
  if (!dobInput) return '';

  // Case 1: It's a Date object from XLSX parsing
  if (dobInput instanceof Date) {
    const year = dobInput.getFullYear();
    const month = String(dobInput.getMonth() + 1).padStart(2, '0');
    const day = String(dobInput.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const dobString = String(dobInput).trim();

  // Case 2: Already in YYYY-MM-DD format (or similar with different separators)
  const ymdMatch = dobString.match(/^(\d{4})[-/.]?(\d{2})[-/.]?(\d{2})/);
  if (ymdMatch) {
    return `${ymdMatch[1]}-${ymdMatch[2]}-${ymdMatch[3]}`;
  }

  // Case 3: Just digits
  const digits = dobString.replace(/[^0-9]/g, '');

  if (digits.length === 8) { // YYYYMMDD
    return `${digits.substring(0, 4)}-${digits.substring(4, 6)}-${digits.substring(6, 8)}`;
  }
  
  if (digits.length === 6) { // YYMMDD
    let year = parseInt(digits.substring(0, 2), 10);
    // Heuristic: years less than 50 are considered 20xx, otherwise 19xx.
    // e.g., '01' -> 2001, '98' -> 1998
    const fullYear = year + (year < 50 ? 2000 : 1900);
    return `${fullYear}-${digits.substring(2, 4)}-${digits.substring(4, 6)}`;
  }

  // Fallback for unrecognized formats
  return dobString;
};

export const isWorkerActiveInMonth = (worker: import('../types').SupportWorker, month: number, year: number): boolean => {
    if (!worker.servicePeriod.start) return false;
    try {
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0); // Last day of the month

        const workerStart = new Date(worker.servicePeriod.start);
        const workerEnd = worker.servicePeriod.end ? new Date(worker.servicePeriod.end) : null;

        // An empty end date means the worker is currently active.
        // Check for overlap: worker period must start before month ends, and must end after month starts.
        return workerStart <= monthEnd && (!workerEnd || workerEnd >= monthStart);
    } catch (e) {
        console.error("Error parsing worker service period date:", e);
        return false;
    }
};

/**
 * Checks if a client has an active contract during the specified month/year.
 * Handles multiple contract periods (contractHistory).
 */
export const isClientActiveInMonth = (client: Client, month: number, year: number): boolean => {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);

    // If history exists, check all periods. Otherwise fall back to the main start/end
    const periods = (client.contractHistory && client.contractHistory.length > 0)
        ? client.contractHistory
        : [{ start: client.contractStart, end: client.contractEnd }];

    return periods.some(period => {
        if (!period.start) return false;
        try {
            const contractStart = new Date(period.start);
            const contractEnd = new Date(period.end);

            // Check overlap: Start <= MonthEnd AND End >= MonthStart
            return contractStart <= monthEnd && contractEnd >= monthStart;
        } catch (e) {
            console.error("Error checking client activity:", e);
            return false;
        }
    });
};

export const formatDobToYYMMDD = (dob: string): string => {
    if (!dob) return '';
    const normalized = normalizeDob(dob); // Use existing normalizer first
    const parts = normalized.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
        return parts[0].substring(2) + parts[1] + parts[2];
    }
    // Handle cases where dob might already be 6 digits
    const digitsOnly = normalized.replace(/[^0-9]/g, '');
    if (digitsOnly.length === 6) return digitsOnly;
    return dob; // Fallback
};

export const formatDateTime = (dateString: string): string => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (e) {
        console.error("Error formatting date:", e);
        return dateString;
    }
};
