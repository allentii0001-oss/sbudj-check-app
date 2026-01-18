
import React, { useState, useEffect, useCallback } from 'react';
import type { Client, RetroactiveDataHash, RetroactivePaymentItem, RetroactiveSubmissionStatus, SubmissionData, ViewType, AccessLog, AdminSettings } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { MainView } from './components/MainView';
import { ClientListView } from './components/ClientListView';
import { SubmissionInputView } from './components/SubmissionInputView';
import { UnsubmittedView } from './components/UnsubmittedView';
import { RetroactivePaymentView } from './components/RetroactivePaymentView';
import { initializeMsal, signIn, signOut, uploadDataToCloud, downloadDataFromCloud } from './services/onedrive';
import { getSubmissionKey } from './utils/helpers';

const initialClients: Client[] = [
    {
        id: '1',
        name: '김이용',
        dob: '1988-05-15',
        contractStart: '2025-01-01',
        contractEnd: '2025-12-31',
        familySupport: true,
        supportWorkers: [
            { id: 'sw1', name: '박지원', dob: '1990-01-01', servicePeriod: { start: '2025-01-01', end: '2025-12-31' } }
        ],
    }
];

export default function App() {
  const [view, setView] = useState<ViewType>('main');
  const [baseYear, setBaseYear] = useLocalStorage<number>('baseYear', 2025);
  const [baseMonth, setBaseMonth] = useLocalStorage<number>('baseMonth', 4); 

  const [clients, setClients] = useLocalStorage<Client[]>('clients', initialClients);
  const [submissionData, setSubmissionData] = useLocalStorage<SubmissionData>('submissionData', {});
  const [retroactiveData, setRetroactiveData] = useLocalStorage<RetroactivePaymentItem[]>('retroactiveData', []);
  const [retroactiveHashes, setRetroactiveHashes] = useLocalStorage<RetroactiveDataHash>('retroactiveHashes', {});
  const [retroactiveSubmissions, setRetroactiveSubmissions] = useLocalStorage<RetroactiveSubmissionStatus>('retroactiveSubmissions', {});
  
  // Admin Settings (Password from file)
  const [adminSettings, setAdminSettings] = useLocalStorage<AdminSettings>('adminSettings', { password: '2888' });

  // Access Logging States
  const [accessLogs, setAccessLogs] = useLocalStorage<AccessLog[]>('accessLogs', []);
  const [userName, setUserName] = useLocalStorage<string>('userName', '');

  // OneDrive/File System States
  const [clientId, setClientId] = useLocalStorage<string>('onedrive_client_id', '');
  const [msalAccount, setMsalAccount] = useState<any>(null);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [fileHandle, setFileHandle] = useState<any>(null);

  // --- 로그 추가 도우미 ---
  const addLog = useCallback((type: 'login' | 'logout', name: string, currentLogs: AccessLog[]) => {
    const newLog: AccessLog = {
      timestamp: new Date().toISOString(),
      userName: name,
      type: type
    };
    const updatedLogs = [...currentLogs, newLog].slice(-200);
    return updatedLogs;
  }, []);

  // --- 접속 중인 사용자 확인 및 경고 ---
  const checkActiveUsers = useCallback((logs: AccessLog[], currentUserName: string) => {
    const userStatus: Record<string, 'login' | 'logout'> = {};
    [...logs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .forEach(log => {
        userStatus[log.userName] = log.type;
      });
    
    const othersActive = Object.entries(userStatus)
      .filter(([name, status]) => status === 'login' && name !== currentUserName)
      .map(([name]) => name);

    if (othersActive.length > 0) {
      alert(`${othersActive.join(', ')} 직원이 접속 중인 상태입니다. 꼭 확인하신 후 작업을 진행하시기 바랍니다.`);
    }
  }, []);

  const handleForceLogoutAll = async () => {
    if (window.confirm("접속 중인 직원들에게 확인 후 강제 접속 종료를 해주시기 바랍니다. 계속하시겠습니까?")) {
      const userStatus: Record<string, 'login' | 'logout'> = {};
      accessLogs.forEach(log => userStatus[log.userName] = log.type);
      
      const activeOthers = Object.entries(userStatus)
        .filter(([name, status]) => status === 'login' && name !== userName)
        .map(([name]) => name);

      if (activeOthers.length === 0) {
        alert("종료할 다른 접속자가 없습니다.");
        return;
      }

      let newLogs = [...accessLogs];
      activeOthers.forEach(name => {
        newLogs = addLog('logout', name, newLogs);
      });
      
      setAccessLogs(newLogs);
      
      if (fileHandle) {
        await saveToLocalWithLogs(newLogs);
      }
      alert("다른 모든 세션이 종료 처리되었습니다.");
    }
  };

  const saveToLocalWithLogs = async (logsToSave: AccessLog[]) => {
    if (!fileHandle) return;
    try {
        const dataToExport = {
            baseYear, baseMonth, clients, submissionData, retroactiveData, retroactiveHashes, retroactiveSubmissions,
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
            if (json.accessLogs) {
              checkActiveUsers(json.accessLogs, userName);
              const updatedLogs = addLog('login', userName, json.accessLogs);
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
        
        if (json.accessLogs) {
          checkActiveUsers(json.accessLogs, userName);
          const updatedLogs = addLog('login', userName, json.accessLogs);
          setAccessLogs(updatedLogs);
          
          const dataToUpdate = {
            baseYear, baseMonth, clients, submissionData, retroactiveData, retroactiveHashes, retroactiveSubmissions,
            adminSettings: json.adminSettings || adminSettings,
            ...json, 
            accessLogs: updatedLogs,
            savedAt: new Date().toISOString()
          };
          
          const writable = await fileHandle.createWritable();
          await writable.write(JSON.stringify(dataToUpdate, null, 2));
          await writable.close();
        }
        alert("최신 데이터를 성공적으로 다시 불러왔습니다.");
    } catch (err: any) {
        alert("데이터를 다시 불러오지 못했습니다. 파일을 다시 연결해주세요.\n" + err.message);
        setFileHandle(null);
    }
  };

  const handleDirectLocalSave = async () => {
    if (!fileHandle) return;
    try {
        const updatedLogs = addLog('logout', userName, accessLogs);
        setAccessLogs(updatedLogs);

        const dataToExport = {
            baseYear, baseMonth, clients, submissionData, retroactiveData, retroactiveHashes, retroactiveSubmissions,
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
     if (!json.clients || !Array.isArray(json.clients)) return;
     if (json.baseYear) setBaseYear(json.baseYear);
     if (json.baseMonth !== undefined) setBaseMonth(json.baseMonth);
     if (json.clients) setClients(json.clients);
     if (json.submissionData) setSubmissionData(json.submissionData);
     if (json.retroactiveData) setRetroactiveData(json.retroactiveData);
     if (json.retroactiveHashes) setRetroactiveHashes(json.retroactiveHashes);
     if (json.retroactiveSubmissions) setRetroactiveSubmissions(json.retroactiveSubmissions);
     if (json.accessLogs) setAccessLogs(json.accessLogs);
     if (json.adminSettings) setAdminSettings(json.adminSettings);
  };

  const handleExportData = () => {
    const dataToExport = {
      baseYear, baseMonth, clients, submissionData, retroactiveData, retroactiveHashes, retroactiveSubmissions,
      adminSettings,
      accessLogs: addLog('logout', userName, accessLogs),
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
        if (json.accessLogs) checkActiveUsers(json.accessLogs, userName);
      } catch (err) { alert("파일 오류"); }
    };
    reader.readAsText(file);
  };

  const handleUpdateAdminSettings = (newSettings: AdminSettings) => {
    setAdminSettings(newSettings);
    // 즉시 파일에 반영 시도 (연동 중인 경우)
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
            retroactiveData={retroactiveData} retroactiveSubmissions={retroactiveSubmissions} setRetroactiveSubmissions={setRetroactiveSubmissions}
            baseYear={baseYear} onBack={() => setView('main')} />
        ) : view === 'unsubmitted' ? (
          <UnsubmittedView clients={clients} submissionData={submissionData} retroactiveData={retroactiveData} baseMonth={baseMonth} baseYear={baseYear} onBack={() => setView('main')} />
        ) : (
          <RetroactivePaymentView retroactiveData={retroactiveData} setRetroactiveData={setRetroactiveData} onBack={() => setView('main')} />
        )}
      </main>
    </div>
  );
}
