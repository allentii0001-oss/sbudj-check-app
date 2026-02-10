
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
  active?: boolean; // Optional UI state
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

export interface PaymentItem {
    id: string;
    clientName: string;
    clientDob: string;
    serviceStart: string;
    serviceEnd: string;
    workerName: string;
    workerDob: string;
    paymentType: string; // 결제구분 (소급, 예외, 일반 등)
    returnType: string; // 반납구분
    reason?: string; // 소급결제사유
    month: number;
}

export interface RetroactivePaymentItem extends PaymentItem {
    // Inherits everything, essentially aliases for backward compatibility if needed
    // But we will use PaymentItem mostly now.
}

export type RetroactiveSubmissionStatus = {
  [itemId: string]: boolean;
};

export type RetroactiveDataHash = {
  [key: string]: string; 
};

export interface AccessLog {
  userName: string;
  loginTime: string;
  logoutTime: string | null;
}

export interface AdminSettings {
  password?: string;
}

export type ViewType = 'main' | 'list' | 'input' | 'unsubmitted' | 'retroactive';

export interface OneDriveConfig {
  clientId: string;
  isLoggedIn: boolean;
  lastSyncTime: string | null;
}
