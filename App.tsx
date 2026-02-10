
import React, { useState, useEffect, useCallback } from 'react';
import type { Client, RetroactiveDataHash, PaymentItem, RetroactiveSubmissionStatus, SubmissionData, ViewType, AccessLog, AdminSettings } from './types';
import { MainView } from './components/MainView';
import { ClientListView } from './components/ClientListView';
import { SubmissionInputView } from './components/SubmissionInputView';
import { UnsubmittedView } from './components/UnsubmittedView';
import { RetroactivePaymentView } from './components/RetroactivePaymentView';
import { initializeMsal, signIn, signOut, uploadDataToCloud, downloadDataFromCloud } from './services/onedrive';
import { getSubmissionKey } from './utils/helpers';

// Default empty initial states (No LocalStorage)
const initialClients: Client[] = [];

export default function App() {
  const [view, setView] = useState<ViewType>('main');
  
  // State management using standard useState (Memory only, lost on refresh if not saved/loaded)
  const [baseYear, setBaseYear] = useState<number>(new Date().getFullYear());
  const [baseMonth, setBaseMonth] = useState<number>(new Date().getMonth()); 

  const [clients, setClients] = useState<Client[]>([]);
  const [submissionData, setSubmissionData] = useState<SubmissionData>({});
  
  // allPayments holds ALL rows from the uploaded Excel (Normal, Retro, Exception), excluding '반납'
  const [allPayments, setAllPayments] = useState<PaymentItem[]>([]);
  
  const [retroactiveHashes, setRetroactiveHashes] = useState<RetroactiveDataHash>({});
  const [retroactiveSubmissions, setRetroactiveSubmissions] = useState<RetroactiveSubmissionStatus>({});
  
  // Admin Settings
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({ password: '2888' });

  // Access Logging States
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [userName, setUserName] = useState<string>('');

  // OneDrive/File System States
  const [clientId, setClientId] = useState<string>('');
  const [msalAccount, setMsalAccount] = useState<any>(null);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [fileHandle, setFileHandle] = useState<any>(null);

  // Derived retroactive data for compatibility with existing views
  // Filter allPayments for "소급" or "예외" in paymentType
  const retroactiveData = React.useMemo(() => {
    return allPayments.filter(item => 
        (item.paymentType && (item.paymentType.includes('소급') || item.paymentType.includes('예외')))
    );
  }, [allPayments]);

  // --- 세션 관리 도우미 (로그인) ---
  const handleLoginSession = useCallback((name: string, currentLogs: AccessLog[], forceNew: boolean = false) => {
    const now = new Date().toISOString();
    let logs = [...currentLogs];

    if (forceNew) {
        let hasClosedSession = false;
        logs = logs.map(log => {
            if (log.userName === name && !log.logoutTime) {
                hasClosedSession = true;
                return { ...log, logoutTime: now };
            }
            return log;
        });
    }

    const activeSession = logs.find(log => log.userName === name && !log.logoutTime);
    if (!forceNew && activeSession) {
        return logs;
    }

    const newSession: AccessLog = {
        userName: name,
        loginTime: now,
        logoutTime: null
    };
    return [...logs, newSession];
  }, []);

  // --- 세션 관리 도우미 (로그아웃) ---
  const handleLogoutSession = useCallback((name: string, currentLogs: AccessLog[]) => {
      return currentLogs.map(log => {
          if (log.userName === name && !log.logoutTime) {
              return { ...log, logoutTime: new Date().toISOString() };
          }
          return log;
      });
  }, []);

  // --- 접속 중인 사용자 확인 및 경고 ---
  const checkActiveUsers = useCallback((logs: AccessLog[], currentUserName: string) => {
    const activeOthers = logs
        .filter(log => !log.logoutTime && log.userName !== currentUserName)
        .map(log => log.userName);

    if (activeOthers.length > 0) {
      alert(`${activeOthers.join(', ')} 직원이 접속 중인 상태입니다. 꼭 확인하신 후 작업을 진행하시기 바랍니다.`);
    }
  }, []);

  const handleForceLogoutAll = async () => {
    if (window.confirm("접속 중인 다른 직원들을 강제로 로그아웃 처리하시겠습니까? (본인은 제외됩니다)")) {
      const activeOthersCount = accessLogs.filter(log => !log.logoutTime && log.userName !== userName).length;

      if (activeOthersCount === 0) {
        alert("종료할 다른 접속자가 없습니다.");
        return;
      }

      const now = new Date().toISOString();
      const updatedLogs = accessLogs.map(log => {
        if (!log.logoutTime && log.userName !== userName) {
          return { ...log, logoutTime: now };
        }
        return log;
      });
      
      setAccessLogs(updatedLogs);
      
      if (fileHandle) {
        await saveToLocalWithLogs(updatedLogs);
      }
      alert("다른 모든 직원의 접속 세션이 강제 종료 처리되었습니다.");
    }
  };

  const saveToLocalWithLogs = async (logsToSave: AccessLog[]) => {
    if (!fileHandle) return;
    try {
        const dataToExport = {
            baseYear, baseMonth, clients, submissionData, allPayments, retroactiveHashes, retroactiveSubmissions,
            adminSettings,
            accessLogs: logsToSave,
            savedAt: new Date().toISOString()
        };
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(dataToExport, null, 2));
        await writable.close();
    } catch (e) {
        console.error("Auto save failed", e);
    }
  };

  const handleConnectLocalFile = async () => {
    try {
        if (!('showOpenFilePicker' in window)) {
            alert("최신 브라우저를 이용해주세요.");
            return;
        }
        const [handle] = await (window as any).showOpenFilePicker({
            types: [{ description: 'JSON 데이터 파일', accept: { 'application/json': ['.json'] } }],
            multiple: false
        });
        setFileHandle(handle);
        const file = await handle.getFile();
        const text = await file.text();
        const json = JSON.parse(text);
        
        if (confirm(`"${handle.name}" 파일을 연결하시겠습니까?`)) {
            applyImportedData(json);
            const logsFromFile = json.accessLogs || [];
            
            checkActiveUsers(logsFromFile, userName);
            
            const updatedLogs = handleLoginSession(userName, logsFromFile, true);
            setAccessLogs(updatedLogs);
            
            const dataToExport = {
                ...json,
                accessLogs: updatedLogs,
                savedAt: new Date().toISOString()
            };
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(dataToExport, null, 2));
            await writable.close();
        }
    } catch (err: any) {
        if (err.name !== 'AbortError') alert("오류: " + err.message);
    }
  };

  const handleRefreshLocalFile = async () => {
    if (!fileHandle) return;
    try {
        const file = await fileHandle.getFile();
        const text = await file.text();
        const json = JSON.parse(text);
        
        applyImportedData(json);
        const logsFromFile = json.accessLogs || [];
        
        checkActiveUsers(logsFromFile, userName);
        
        const updatedLogs = handleLoginSession(userName, logsFromFile, false);
        setAccessLogs(updatedLogs);
        
        // Merge data
        const dataToUpdate = {
          baseYear, baseMonth, clients, submissionData, allPayments, retroactiveHashes, retroactiveSubmissions,
          adminSettings: json.adminSettings || adminSettings,
          ...json, 
          accessLogs: updatedLogs,
          savedAt: new Date().toISOString()
        };
        
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(dataToUpdate, null, 2));
        await writable.close();
        
        alert("최신 데이터를 성공적으로 다시 불러왔습니다.");
    } catch (err: any) {
        alert("데이터를 다시 불러오지 못했습니다. 파일을 다시 연결해주세요.\n" + err.message);
        setFileHandle(null);
    }
  };

  const handleDirectLocalSave = async () => {
    if (!fileHandle) return;
    try {
        const updatedLogs = handleLogoutSession(userName, accessLogs);
        setAccessLogs(updatedLogs);

        const dataToExport = {
            baseYear, baseMonth, clients, submissionData, allPayments, retroactiveHashes, retroactiveSubmissions,
            adminSettings,
            accessLogs: updatedLogs,
            savedAt: new Date().toISOString()
        };
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(dataToExport, null, 2));
        await writable.close();
        
        setFileHandle(null);
        alert(`성공적으로 저장되었습니다. 파일 연동이 종료됩니다.`);
    } catch (err: any) {
        alert("저장 오류: " + err.message);
    }
  };

  const applyImportedData = (json: any) => {
     if (json.baseYear) setBaseYear(json.baseYear);
     if (json.baseMonth !== undefined) setBaseMonth(json.baseMonth);
     if (json.clients && Array.isArray(json.clients)) setClients(json.clients);
     if (json.submissionData) setSubmissionData(json.submissionData);
     // Support old retroactiveData field if allPayments is missing, otherwise use allPayments
     if (json.allPayments) {
         setAllPayments(json.allPayments);
     } else if (json.retroactiveData) {
         setAllPayments(json.retroactiveData); // Fallback for old files
     }
     if (json.retroactiveHashes) setRetroactiveHashes(json.retroactiveHashes);
     if (json.retroactiveSubmissions) setRetroactiveSubmissions(json.retroactiveSubmissions);
     if (json.adminSettings) setAdminSettings(json.adminSettings);
  };

  const handleExportData = () => {
    const dataToExport = {
      baseYear, baseMonth, clients, submissionData, allPayments, retroactiveHashes, retroactiveSubmissions,
      adminSettings,
      accessLogs: handleLogoutSession(userName, accessLogs), 
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `활동지원사_데이터_${new Date().getTime()}.json`;
    link.click();
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        applyImportedData(json);
        if (json.accessLogs) {
            checkActiveUsers(json.accessLogs, userName);
            setAccessLogs(json.accessLogs);
        }
      } catch (err) { alert("파일 오류"); }
    };
    reader.readAsText(file);
  };

  const handleUpdateAdminSettings = (newSettings: AdminSettings) => {
    setAdminSettings(newSettings);
    if (fileHandle) {
       saveToLocalWithLogs(accessLogs);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <main>
        {view === 'main' ? (
          <MainView 
            setView={setView} baseMonth={baseMonth} setBaseMonth={setBaseMonth} baseYear={baseYear} setBaseYear={setBaseYear}
            onExportData={handleExportData} onImportData={handleImportData}
            clientId={clientId} setClientId={setClientId} msalAccount={msalAccount}
            onCloudLogin={() => {}} onCloudLogout={() => {}} onCloudSave={() => {}} onCloudLoad={() => {}} isCloudLoading={isCloudLoading}
            fileHandle={fileHandle} onConnectLocalFile={handleConnectLocalFile} onRefreshLocalFile={handleRefreshLocalFile} onDirectLocalSave={handleDirectLocalSave}
            accessLogs={accessLogs} userName={userName} setUserName={setUserName} onForceLogoutAll={handleForceLogoutAll}
            adminSettings={adminSettings} onUpdateAdminSettings={handleUpdateAdminSettings}
          />
        ) : view === 'list' ? (
          <ClientListView clients={clients} setClients={setClients} onBack={() => setView('main')} />
        ) : view === 'input' ? (
          <SubmissionInputView 
            clients={clients} setClients={setClients} submissionData={submissionData} setSubmissionData={setSubmissionData}
            retroactiveData={retroactiveData} allPayments={allPayments} retroactiveSubmissions={retroactiveSubmissions} setRetroactiveSubmissions={setRetroactiveSubmissions}
            baseYear={baseYear} baseMonth={baseMonth} onBack={() => setView('main')} />
        ) : view === 'unsubmitted' ? (
          <UnsubmittedView clients={clients} submissionData={submissionData} retroactiveData={retroactiveData} baseMonth={baseMonth} baseYear={baseYear} onBack={() => setView('main')} />
        ) : (
          <RetroactivePaymentView allPayments={allPayments} setAllPayments={setAllPayments} clients={clients} onBack={() => setView('main')} />
        )}
      </main>
    </div>
  );
}
