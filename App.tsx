
import React, { useState, useEffect } from 'react';
import type { Client, RetroactiveDataHash, RetroactivePaymentItem, RetroactiveSubmissionStatus, SubmissionData, ViewType } from './types';
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
    },
    {
        id: '2',
        name: '이도움',
        dob: '2001-11-20',
        contractStart: '2025-03-01',
        contractEnd: '2025-10-01',
        familySupport: false,
        supportWorkers: [],
    }
];

export default function App() {
  const [view, setView] = useState<ViewType>('main');
  const [baseYear, setBaseYear] = useLocalStorage<number>('baseYear', 2025);
  const [baseMonth, setBaseMonth] = useLocalStorage<number>('baseMonth', 4); // 4 = 5월

  const [clients, setClients] = useLocalStorage<Client[]>('clients', initialClients);
  const [submissionData, setSubmissionData] = useLocalStorage<SubmissionData>('submissionData', {});
  const [retroactiveData, setRetroactiveData] = useLocalStorage<RetroactivePaymentItem[]>('retroactiveData', []);
  const [retroactiveHashes, setRetroactiveHashes] = useLocalStorage<RetroactiveDataHash>('retroactiveHashes', {});
  const [retroactiveSubmissions, setRetroactiveSubmissions] = useLocalStorage<RetroactiveSubmissionStatus>('retroactiveSubmissions', {});

  // OneDrive States
  const [clientId, setClientId] = useLocalStorage<string>('onedrive_client_id', '');
  const [msalAccount, setMsalAccount] = useState<any>(null);
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  // File System Access State
  const [fileHandle, setFileHandle] = useState<any>(null);

  // --- Data Migration for Year Support ---
  useEffect(() => {
    let hasChanges = false;
    
    // 1. Migrate Submission Data keys from "id-month" to "id-year-month"
    const newSubmissionData = { ...submissionData };
    Object.keys(newSubmissionData).forEach(key => {
        const parts = key.split('-');
        // Basic check: if strictly 2 parts "id-month" OR last part is month index and 2nd last is NOT a year
        const lastPart = parts[parts.length - 1];
        const secondLastPart = parts.length > 1 ? parts[parts.length - 2] : null;
        
        const isYear = secondLastPart && /^\d{4}$/.test(secondLastPart);
        
        if (!isYear) {
            // Assume it's old format. Migrate to current baseYear.
            const monthIndex = parseInt(lastPart, 10);
            if (!isNaN(monthIndex)) {
                const idPart = parts.slice(0, -1).join('-'); // Handle IDs with hyphens
                const newKey = getSubmissionKey(idPart, baseYear, monthIndex);
                
                if (!newSubmissionData[newKey]) {
                    newSubmissionData[newKey] = newSubmissionData[key];
                }
                delete newSubmissionData[key];
                hasChanges = true;
            }
        }
    });

    // 2. Migrate Retroactive Hashes keys
    const newRetroHashes = { ...retroactiveHashes };
    Object.keys(newRetroHashes).forEach(key => {
         const parts = key.split('-');
         const lastPart = parts[parts.length - 1];
         const secondLastPart = parts.length > 1 ? parts[parts.length - 2] : null;
         const isYear = secondLastPart && /^\d{4}$/.test(secondLastPart);

         if (!isYear) {
             const monthIndex = parseInt(lastPart, 10);
             if (!isNaN(monthIndex)) {
                 const idPart = parts.slice(0, -1).join('-');
                 const newKey = getSubmissionKey(idPart, baseYear, monthIndex);
                 if (!newRetroHashes[newKey]) {
                    newRetroHashes[newKey] = newRetroHashes[key];
                 }
                 delete newRetroHashes[key];
                 hasChanges = true;
             }
         }
    });

    if (hasChanges) {
        setSubmissionData(newSubmissionData);
        setRetroactiveHashes(newRetroHashes);
        console.log("Legacy data migrated to include year in keys.");
    }
  }, []); // Run once on mount

  // Initialize MSAL when clientId changes
  useEffect(() => {
    if (clientId) {
      initializeMsal(clientId).catch(err => console.error("MSAL Init Error:", err));
    }
  }, [clientId]);

  // --- Local File System Access API Handlers ---
  const handleConnectLocalFile = async () => {
    try {
        // Check browser support
        if (!('showOpenFilePicker' in window)) {
            alert("이 기능은 Chrome, Edge, Opera 등 최신 브라우저에서만 지원됩니다.\n다른 브라우저에서는 '수동 파일 백업' 기능을 이용해주세요.");
            return;
        }

        const [handle] = await (window as any).showOpenFilePicker({
            types: [{
                description: 'JSON 데이터 파일',
                accept: { 'application/json': ['.json'] }
            }],
            multiple: false
        });

        setFileHandle(handle);
        
        // Immediately try to load data from the file
        const file = await handle.getFile();
        const text = await file.text();
        const json = JSON.parse(text);
        
        if (confirm(`"${handle.name}" 파일을 연결하고 데이터를 불러오시겠습니까?\n현재 앱의 데이터가 파일의 내용으로 변경됩니다.`)) {
            applyImportedData(json);
        }

    } catch (err: any) {
        // Handle Cross-Origin Frame Error specifically
        if (err.name === 'SecurityError' || (err.message && err.message.includes('Cross origin sub frames'))) {
             alert("보안 정책상 현재 미리보기 화면(Iframe)에서는 파일 시스템 직접 접근이 제한됩니다.\n\n이 기능을 사용하려면:\n1. 앱을 '새 창' 또는 '새 탭'에서 열어주세요.\n2. 또는 아래의 '수동 파일 백업' 기능을 이용해주세요.");
             return;
        }
        
        if (err.name !== 'AbortError') {
            console.error(err);
            alert("파일 연결 중 오류가 발생했습니다: " + err.message);
        }
    }
  };

  const handleDirectLocalSave = async () => {
    if (!fileHandle) {
        alert("연결된 파일이 없습니다. 먼저 파일을 연결해주세요.");
        return;
    }

    try {
        const dataToExport = {
            baseYear,
            baseMonth,
            clients,
            submissionData,
            retroactiveData,
            retroactiveHashes,
            retroactiveSubmissions,
            savedAt: new Date().toISOString()
        };

        // Create a writable stream to the file
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(dataToExport, null, 2));
        await writable.close();

        alert(`"${fileHandle.name}" 파일에 저장되었습니다.`);
    } catch (err: any) {
        console.error(err);
        if (err.name === 'SecurityError' || (err.message && err.message.includes('Cross origin sub frames'))) {
             alert("보안 정책상 현재 화면에서는 파일 저장이 제한될 수 있습니다.\n새 창에서 앱을 열어 시도해주세요.");
             return;
        }
        alert("저장 중 오류가 발생했습니다. 권한을 확인해주세요.\n오류: " + err.message);
    }
  };

  // --- OneDrive Cloud Handlers (Azure) ---
  const handleCloudLogin = async () => {
    if (!clientId) {
      alert("설정(⚙️)에서 Client ID를 먼저 입력해주세요.");
      return;
    }
    try {
      const account = await signIn();
      setMsalAccount(account);
    } catch (e: any) {
      console.error(e);
      alert("로그인에 실패했습니다.\n" + (e.message || ""));
    }
  };

  const handleCloudLogout = async () => {
    try {
        await signOut();
        setMsalAccount(null);
    } catch (e) {
        console.error(e);
    }
  };

  const handleCloudSave = async () => {
    if (!msalAccount) return;
    if (!window.confirm("현재 작업 내용을 원드라이브에 저장하시겠습니까?\n기존 원드라이브 파일은 덮어씌워집니다.")) return;

    setIsCloudLoading(true);
    try {
        const dataToExport = {
            baseYear,
            baseMonth,
            clients,
            submissionData,
            retroactiveData,
            retroactiveHashes,
            retroactiveSubmissions,
            savedAt: new Date().toISOString()
        };

        await uploadDataToCloud(msalAccount, dataToExport);
        alert("원드라이브에 성공적으로 저장되었습니다!");
    } catch (e: any) {
        console.error(e);
        alert("저장 실패: " + (e.message || "오류가 발생했습니다."));
    } finally {
        setIsCloudLoading(false);
    }
  };

  const handleCloudLoad = async () => {
    if (!msalAccount) return;
    if (!window.confirm("원드라이브에서 데이터를 불러오시겠습니까?\n현재 작업 중인 내용은 덮어씌워집니다.")) return;

    setIsCloudLoading(true);
    try {
        const json = await downloadDataFromCloud(msalAccount);
        
        if (!json) {
            alert("원드라이브에 저장된 데이터 파일이 없습니다.");
            return;
        }

        applyImportedData(json);
        const savedDate = json.savedAt ? new Date(json.savedAt).toLocaleString() : '알 수 없음';
        alert(`데이터를 성공적으로 불러왔습니다.\n(저장된 시간: ${savedDate})`);

    } catch (e: any) {
        console.error(e);
        alert("불러오기 실패: " + (e.message || "오류가 발생했습니다."));
    } finally {
        setIsCloudLoading(false);
    }
  };

  const applyImportedData = (json: any) => {
     if (!json.clients || !Array.isArray(json.clients)) {
         throw new Error("올바르지 않은 데이터 형식입니다.");
     }
     if (json.baseYear) setBaseYear(json.baseYear);
     if (json.baseMonth !== undefined) setBaseMonth(json.baseMonth);
     if (json.clients) setClients(json.clients);
     if (json.submissionData) setSubmissionData(json.submissionData);
     if (json.retroactiveData) setRetroactiveData(json.retroactiveData);
     if (json.retroactiveHashes) setRetroactiveHashes(json.retroactiveHashes);
     if (json.retroactiveSubmissions) setRetroactiveSubmissions(json.retroactiveSubmissions);
  };


  // --- Manual Local File Export/Import ---
  const handleExportData = () => {
    const dataToExport = {
      baseYear,
      baseMonth,
      clients,
      submissionData,
      retroactiveData,
      retroactiveHashes,
      retroactiveSubmissions,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    link.download = `활동지원사_데이터백업_${timestamp}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (window.confirm(`"${file.name}" 파일의 데이터로 현재 데이터를 덮어씌우시겠습니까?\n이 작업은 취소할 수 없습니다.`)) {
            applyImportedData(json);
            alert("데이터가 성공적으로 복원되었습니다.");
        }
      } catch (err) {
        console.error(err);
        alert("파일을 불러오는 중 오류가 발생했습니다. 올바른 백업 파일인지 확인해주세요.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const renderView = () => {
    switch (view) {
      case 'list':
        return <ClientListView clients={clients} setClients={setClients} onBack={() => setView('main')} />;
      case 'input':
        return <SubmissionInputView 
                  clients={clients}
                  setClients={setClients}
                  submissionData={submissionData}
                  setSubmissionData={setSubmissionData}
                  retroactiveData={retroactiveData}
                  retroactiveHashes={retroactiveHashes}
                  setRetroactiveHashes={setRetroactiveHashes}
                  retroactiveSubmissions={retroactiveSubmissions}
                  setRetroactiveSubmissions={setRetroactiveSubmissions}
                  baseYear={baseYear}
                  onBack={() => setView('main')} />;
      case 'unsubmitted':
        return <UnsubmittedView 
                  clients={clients} 
                  submissionData={submissionData} 
                  retroactiveData={retroactiveData}
                  baseMonth={baseMonth}
                  baseYear={baseYear}
                  onBack={() => setView('main')} />;
      case 'retroactive':
        return <RetroactivePaymentView 
                  retroactiveData={retroactiveData} 
                  setRetroactiveData={setRetroactiveData} 
                  onBack={() => setView('main')} />;
      case 'main':
      default:
        return <MainView 
                  setView={setView} 
                  baseMonth={baseMonth}
                  setBaseMonth={setBaseMonth}
                  baseYear={baseYear}
                  setBaseYear={setBaseYear}
                  onExportData={handleExportData}
                  onImportData={handleImportData}
                  // OneDrive Props
                  clientId={clientId}
                  setClientId={setClientId}
                  msalAccount={msalAccount}
                  onCloudLogin={handleCloudLogin}
                  onCloudLogout={handleCloudLogout}
                  onCloudSave={handleCloudSave}
                  onCloudLoad={handleCloudLoad}
                  isCloudLoading={isCloudLoading}
                  // File System Props
                  fileHandle={fileHandle}
                  onConnectLocalFile={handleConnectLocalFile}
                  onDirectLocalSave={handleDirectLocalSave}
                />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans">
      <main>{renderView()}</main>
    </div>
  );
}
