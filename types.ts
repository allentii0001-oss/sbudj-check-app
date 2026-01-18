
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
  contractStart: string; 
  contractEnd: string;   
  contractHistory?: ContractPeriod[]; 
  supportWorkers: SupportWorker[];
  familySupport: boolean;
}

export interface WorkerSubmissionStatus {
  schedule: boolean;
  weeklyReport: boolean;
  retroactivePayment: boolean;
}

export type SubmissionData = {
  [key: string]: {
    noWork: boolean;
    workerSubmissions: {
      [key: string]: WorkerSubmissionStatus;
    };
  };
};

export interface RetroactivePaymentItem {
  id: string; 
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
  [key: string]: string; 
};

export interface AccessLog {
  timestamp: string;
  userName: string;
  type: 'login' | 'logout';
}

export type ViewType = 'main' | 'list' | 'input' | 'unsubmitted' | 'retroactive';

export interface OneDriveConfig {
  clientId: string;
  isLoggedIn: boolean;
  lastSyncTime: string | null;
}
