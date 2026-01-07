
export interface SupportWorker {
  id: string;
  name: string;
  dob: string;
  servicePeriod: {
    start: string;
    end: string;
  };
}

export interface ContractPeriod {
  start: string;
  end: string;
}

export interface Client {
  id: string;
  name: string;
  dob: string;
  contractStart: string; // The latest or active contract start
  contractEnd: string;   // The latest or active contract end
  contractHistory?: ContractPeriod[]; // List of all contract periods
  supportWorkers: SupportWorker[];
  familySupport: boolean;
}

export interface WorkerSubmissionStatus {
  schedule: boolean;
  weeklyReport: boolean;
  retroactivePayment: boolean;
}

export type SubmissionData = {
  // Key: `${clientId}-${monthIndex}`
  [key: string]: {
    noWork: boolean;
    workerSubmissions: {
      // Key: workerId
      [key: string]: WorkerSubmissionStatus;
    };
  };
};

export interface RetroactivePaymentItem {
  id: string; // hash of content
  clientName: string;
  clientDob: string;
  serviceStart: string;
  serviceEnd: string;
  workerName: string;
  workerDob: string;
  month: number;
}

export type RetroactiveSubmissionStatus = {
  [itemId: string]: boolean;
};

export type RetroactiveDataHash = {
  [key: string]: string; // Key: `${clientId}-${monthIndex}` -> hash
};

export type ViewType = 'main' | 'list' | 'input' | 'unsubmitted' | 'retroactive';

export interface OneDriveConfig {
  clientId: string;
  isLoggedIn: boolean;
  lastSyncTime: string | null;
}