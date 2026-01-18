
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

  // Access Logging States - Changed to useState to avoid persistent browser storage for logs
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [userName, setUserName] = useLocalStorage<string>('userName', '');

  // OneDrive/File System States
  const [clientId, setClientId] = useLocalStorage<string>('onedrive_client_id', '');
  const [msalAccount, setMsalAccount] = useState<any>(null);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [fileHandle, setFileHandle] = useState<any>(null);

  // --- 세션 관리 도우미 (로그인) ---
  // forceNew: true일 경우 기존의 열린 세션을 닫고 새로 시작 (앱 최초 접속 시 등)
  // forceNew: false일 경우 기존 세션 유지 (새로고침 시)
  const handleLoginSession = useCallback((name: string, currentLogs: AccessLog[], forceNew: boolean = false) => {
    const now = new Date().toISOString();
    let logs = [...currentLogs];

    // 1. 강제 갱신 모드(최초 접속)라면: 내 이름으로 된 '종료 안 된 세션'을 찾아 종료 처리(로그아웃)
    //    브라우저를 그냥 껐다가 다시 왔을 때, 이전 기록을 닫아주기 위함
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

    // 2. 강제 갱신이 아니고(새로고침 등), 이미 진행 중인 세션이 있다면 유지
    const activeSession = logs.find(log => log.userName === name && !log.logoutTime);
    if (!forceNew && activeSession) {
        return logs;
    }

    // 3. 새로운 접속 세션 추가 (데이터가 쌓이는 순서대로 뒤에 추가)
    // forceNew가 true이거나, forceNew가 false여도 활성 세션이 없는 경우(파일 덮어쓰기 등으로 사라진 경우)
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
        // 나 이외의 종료 기록이 없는(접속 중인) 직원들만 일괄 종료 처리
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
            const logsFromFile = json.accessLogs || [];
            
            checkActiveUsers(logsFromFile, userName);
            
            // 앱 최초 연결 시에는 forceNew=true로 호출하여
            // 혹시 모를 이전 좀비 세션을 닫고 새 세션을 시작합니다.
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
        
        // 새로고침(다시 불러오기) 시에는 forceNew=false로 호출하여
        // 현재 작업 중인 세션을 유지합니다.
        const updatedLogs = handleLoginSession(userName, logsFromFile, false);
        setAccessLogs(updatedLogs);
        
        // 내 세션이 파일에 없었다면 추가되었을 수 있으므로 파일 업데이트
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
     // accessLogs는 state로 관리하므로 여기서 set하지 않고 파일 연결/갱신 로직에서 처리
     if (json.adminSettings) setAdminSettings(json.adminSettings);
  };

  const handleExportData = () => {
    const dataToExport = {
      baseYear, baseMonth, clients, submissionData, retroactiveData, retroactiveHashes, retroactiveSubmissions,
      adminSettings,
      accessLogs: handleLogoutSession(userName, accessLogs), // 내보내기 시 내 세션 닫은 상태로 저장
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
            // 단순 불러오기(보기 전용)이므로 세션 로직은 적용하지 않고 그대로 표시만 함
            setAccessLogs(json.accessLogs);
        }
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
