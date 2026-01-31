
import type { Client, SupportWorker } from '../types';

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
    // Date 객체일 때도 미래 연도 체크 (엑셀 파싱 시 자동변환 되는 경우 대비)
    const currentYear = new Date().getFullYear();
    const finalYear = year > currentYear ? year - 100 : year;
    return `${finalYear}-${month}-${day}`;
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
    const currentYear = new Date().getFullYear();
    
    // 기본적으로 2000년대로 가정하고 계산
    let fullYear = 2000 + year;
    
    // 계산된 연도가 현재 연도보다 크면 1900년대로 처리 (예: 49 -> 2049(X) -> 1949(O))
    if (fullYear > currentYear) {
        fullYear = 1900 + year;
    }
    
    return `${fullYear}-${digits.substring(2, 4)}-${digits.substring(4, 6)}`;
  }

  // Fallback for unrecognized formats
  return dobString;
};

// FIX: Completed the implementation of isWorkerActiveInMonth
export const isWorkerActiveInMonth = (worker: SupportWorker, month: number, year: number): boolean => {
    if (!worker.servicePeriod.start) return false;
    try {
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0); // Last day of the month

        const workerStart = new Date(worker.servicePeriod.start);
        const workerEnd = worker.servicePeriod.end ? new Date(worker.servicePeriod.end) : new Date('2099-12-31');

        return workerStart <= monthEnd && workerEnd >= monthStart;
    } catch (e) {
        return false;
    }
};

/**
 * Checks if a client has an active contract in a specific month of a specific year.
 */
// FIX: Added isClientActiveInMonth helper to check contract validity across history
export const isClientActiveInMonth = (client: Client, month: number, year: number): boolean => {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  if (client.contractHistory && client.contractHistory.length > 0) {
    return client.contractHistory.some(period => {
      const start = new Date(period.start);
      const end = new Date(period.end || '2099-12-31');
      return start <= monthEnd && end >= monthStart;
    });
  }

  const start = new Date(client.contractStart);
  const end = new Date(client.contractEnd || '2099-12-31');
  return start <= monthEnd && end >= monthStart;
};

/**
 * Formats YYYY-MM-DD dob to YYMMDD
 */
// FIX: Added formatDobToYYMMDD helper
export const formatDobToYYMMDD = (dob: string): string => {
  if (!dob) return '';
  const digits = dob.replace(/[^0-9]/g, '');
  if (digits.length === 8) {
    return digits.substring(2);
  }
  if (digits.length === 6) {
    return digits;
  }
  return dob;
};

/**
 * Formats a ISO date string to a readable format (e.g., 05/15 14:30)
 */
// FIX: Added formatDateTime helper
export const formatDateTime = (dateTimeStr: string): string => {
  if (!dateTimeStr) return '';
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hour}:${minute}`;
  } catch {
    return dateTimeStr;
  }
};
