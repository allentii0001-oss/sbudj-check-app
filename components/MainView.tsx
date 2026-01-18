
import React, { useRef, useState, useEffect } from 'react';
import type { ViewType, AccessLog } from '../types';
import { getMonthName, MONTHS } from '../utils/helpers';
import { Modal } from './common/Modal';

interface MainViewProps {
  setView: (view: ViewType) => void;
  baseMonth: number;
  setBaseMonth: React.Dispatch<React.SetStateAction<number>>;
  baseYear: number;
  setBaseYear: React.Dispatch<React.SetStateAction<number>>;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  clientId: string;
  setClientId: (id: string) => void;
  msalAccount: any;
  onCloudLogin: () => void;
  onCloudLogout: () => void;
  onCloudSave: () => void;
  onCloudLoad: () => void;
  isCloudLoading: boolean;
  fileHandle: any;
  onConnectLocalFile: () => void;
  onRefreshLocalFile: () => void; // 신설: 파일 재선택 없는 새로고침
  onDirectLocalSave: () => void;
  accessLogs: AccessLog[];
  userName: string;
  setUserName: (name: string) => void;
  onForceLogoutAll: () => void;
}

const Button: React.FC<{ onClick: () => void; children: React.ReactNode; icon: React.ReactElement }> = ({ onClick, children, icon }) => (
  <button
    onClick={onClick}
    className="w-full sm:w-64 bg-white border border-gray-200 hover:bg-gray-100 text-gray-800 font-semibold py-4 px-6 rounded-lg shadow-sm transition-all duration-200 ease-in-out flex items-center justify-center space-x-3 text-lg"
  >
    {icon}
    <span>{children}</span>
  </button>
);

const ViewListIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const UploadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
const SaveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-4 4m0 0l-4-4m4 4V4" /></svg>;
const LoadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>;
const FolderIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>;
const LinkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;
const HelpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const UserIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>;

const YEARS = Array.from({ length: 7 }, (_, i) => 2024 + i);

export const MainView: React.FC<MainViewProps> = ({ 
    setView, baseMonth, setBaseMonth, baseYear, setBaseYear,
    onExportData, onImportData,
    clientId, setClientId, msalAccount, onCloudLogin, onCloudLogout, onCloudSave, onCloudLoad, isCloudLoading,
    fileHandle, onConnectLocalFile, onRefreshLocalFile, onDirectLocalSave,
    accessLogs, userName, setUserName, onForceLogoutAll
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [tempUserName, setTempUserName] = useState(userName);

  const getActiveUsers = () => {
    const userStatus: Record<string, 'login' | 'logout'> = {};
    [...accessLogs].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .forEach(log => {
        userStatus[log.userName] = log.type;
      });
    
    return Object.entries(userStatus)
      .filter(([name, status]) => status === 'login' && name !== userName)
      .map(([name]) => name);
  };

  const activeUsers = getActiveUsers();

  useEffect(() => {
    if (!userName) {
      setIsUserModalOpen(true);
    }
  }, [userName]);

  const handleSaveUserName = () => {
    if (tempUserName.trim()) {
      setUserName(tempUserName.trim());
      setIsUserModalOpen(false);
    } else {
      alert("이름을 입력해주세요.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 relative">
      
      <div className="w-full max-w-5xl flex flex-col items-center mb-6 space-y-2">
        {activeUsers.length > 0 && (
          <div className="w-full bg-red-100 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-center animate-pulse font-bold">
            ⚠️ {activeUsers.join(', ')} 직원이 접속 중인 상태입니다. 작업 내용이 덮어씌워지지 않도록 주의하세요!
          </div>
        )}
        
        <div className="flex w-full justify-between items-center px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center space-x-2 text-gray-700">
            <UserIcon />
            <span className="font-semibold">{userName || '미설정'}</span>
            <span className="text-xs text-gray-400">접속 중</span>
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={() => { setTempUserName(userName); setIsUserModalOpen(true); }}
              className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded border border-gray-300 transition-colors"
            >
              이름 변경
            </button>
            <button 
              onClick={onForceLogoutAll}
              className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded border border-red-200 transition-colors"
            >
              강제 접속 종료
            </button>
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 flex flex-col items-end space-y-1">
        <button 
            onClick={() => setIsHelpOpen(true)}
            className="flex items-center space-x-1 text-gray-500 hover:text-purple-600 transition-colors bg-white px-3 py-2 rounded-full shadow-sm border border-gray-200"
        >
            <HelpIcon />
            <span className="text-sm font-medium">사용 설명서</span>
        </button>
        <span className="text-[10px] text-gray-300 font-mono pr-2">Ver_1.1</span>
      </div>

      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 tracking-tight">활동지원사 서류 제출 확인</h1>
        <p className="text-lg text-gray-600 mt-2">{baseYear}년 관리 시스템</p>
        
        <div className="mt-8 flex flex-col items-center space-y-4">
            <div className="flex items-center space-x-2">
                <label htmlFor="baseYear" className="text-lg font-medium text-gray-700 w-24 text-right">기준 년도 :</label>
                <select
                    id="baseYear"
                    value={baseYear}
                    onChange={(e) => setBaseYear(Number(e.target.value))}
                    className="bg-white border border-gray-300 text-gray-900 text-lg rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 min-w-[120px]"
                >
                    {YEARS.map(year => <option key={year} value={year}>{year}년</option>)}
                </select>
            </div>
            <div className="flex items-center space-x-2">
                <label htmlFor="baseMonth" className="text-lg font-medium text-gray-700 w-24 text-right">기준 월 :</label>
                <select
                    id="baseMonth"
                    value={baseMonth}
                    onChange={(e) => setBaseMonth(Number(e.target.value))}
                    className="bg-white border border-gray-300 text-gray-900 text-lg rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 min-w-[120px]"
                >
                    {MONTHS.map(month => <option key={month} value={month}>{getMonthName(month)}</option>)}
                </select>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
        <Button onClick={() => setView('list')} icon={<ViewListIcon />}>전체 명단 보기</Button>
        <Button onClick={() => setView('input')} icon={<EditIcon />}>제출 내역 입력</Button>
        <Button onClick={() => setView('unsubmitted')} icon={<SearchIcon />}>미제출 서류 조회</Button>
        <Button onClick={() => setView('retroactive')} icon={<UploadIcon />}>소급결제 내역</Button>
      </div>

      <div className="w-full max-w-2xl space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-md border border-purple-100">
            <div className="flex items-center mb-4">
                <div className="bg-purple-100 p-2 rounded-full mr-3 text-purple-600">
                    <FolderIcon />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">공유 파일 연동 (OneDrive)</h3>
                    <p className="text-sm text-gray-500">공유 폴더 내의 파일을 연결하면 직원 간 실시간 협업이 가능합니다.</p>
                </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                {fileHandle ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center text-green-700 font-medium">
                            <LinkIcon />
                            <span className="ml-2">파일이 연결되었습니다: <b>{fileHandle.name}</b></span>
                        </div>
                        <button onClick={onConnectLocalFile} className="text-xs text-gray-500 underline hover:text-gray-800">다른 파일 선택</button>
                    </div>
                ) : (
                    <div className="text-center py-2">
                        <p className="text-sm text-gray-600 mb-3">
                            PC 내의 <b>OneDrive 폴더</b>에 있는 데이터 파일을 선택해주세요.<br/>
                            <span className="text-xs text-gray-400">(activity_data.json 파일을 찾아 연결하면 됩니다)</span>
                        </p>
                        <button 
                            onClick={onConnectLocalFile}
                            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-lg shadow-sm transition-colors text-sm"
                        >
                            파일 연결하기 (찾아보기)
                        </button>
                    </div>
                )}
            </div>

            {fileHandle && (
                <div className="grid grid-cols-2 gap-4">
                     <button 
                        onClick={onDirectLocalSave}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-sm"
                    >
                        <SaveIcon />
                        <span>저장 후 연동 종료</span>
                    </button>
                    <button 
                        onClick={onRefreshLocalFile}
                        className="bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 font-medium py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                        <LoadIcon />
                        <span>지금 데이터 고침</span>
                    </button>
                </div>
            )}
        </div>

        <div className="flex space-x-3">
            <button 
                onClick={onExportData}
                className="flex-1 bg-white hover:bg-gray-50 text-gray-500 text-xs font-medium py-2 px-4 rounded-lg border border-gray-200 transition-colors"
            >
                수동 백업 다운로드
            </button>
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-white hover:bg-gray-50 text-gray-500 text-xs font-medium py-2 px-4 rounded-lg border border-gray-200 transition-colors"
            >
                백업 파일 불러오기
            </button>
        </div>
        <input type="file" ref={fileInputRef} onChange={onImportData} accept=".json" className="hidden" />
      </div>

      <Modal isOpen={isUserModalOpen} onClose={() => userName && setIsUserModalOpen(false)} title="직원 성함 입력" size="md">
        <div className="space-y-4">
          <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
            <p className="text-sm text-gray-700 leading-relaxed">
              다른 직원들에게 <b>본인이 현재 사용 중임</b>을 알리기 위해 이름을 입력해주세요.
            </p>
            <p className="text-[11px] text-red-500 mt-2 font-semibold">
              ※ 브라우저 기록 상태에 따라 이름 설정이 다시 필요할 수 있습니다.
            </p>
          </div>
          <input 
            type="text" 
            value={tempUserName}
            onChange={(e) => setTempUserName(e.target.value)}
            placeholder="성함 (예: 홍길동)"
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500 text-lg font-bold"
            autoFocus
          />
          <button 
            onClick={handleSaveUserName}
            className="w-full bg-purple-600 text-white py-4 rounded-lg font-bold hover:bg-purple-700 transition-colors shadow-lg"
          >
            확인
          </button>
        </div>
      </Modal>

      <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="활동지원사 서류 앱 업무 매뉴얼" size="3xl">
        <div className="space-y-6 text-gray-700">
            <section>
                <h3 className="font-bold text-lg text-purple-700 mb-2">1. 시작하기: 이름 입력 및 파일 연결</h3>
                <ul className="list-disc ml-5 space-y-2 text-sm">
                    <li>앱 접속 시 본인의 성함을 입력합니다. (동시 접속 확인용)</li>
                    <li>중앙의 <b>[파일 연결하기]</b> 버튼을 눌러 컴퓨터 내 OneDrive 폴더의 <code>activity_data.json</code> 파일을 선택합니다.</li>
                    <li>한 번 연결된 파일은 브라우저를 닫기 전까지 유지됩니다.</li>
                </ul>
            </section>

            <section className="bg-red-50 p-4 rounded-lg border border-red-100">
                <h3 className="font-bold text-lg text-red-800 mb-2">2. 협업 수칙 (데이터 보호)</h3>
                <p className="text-sm leading-relaxed mb-2 font-medium">상단에 <b>빨간색 경고창</b>이 뜨면 다른 직원이 현재 파일을 열고 작업 중이라는 뜻입니다.</p>
                <ul className="list-disc ml-5 space-y-1 text-xs text-red-700">
                    <li>이때 저장을 하면 상대방의 작업 내용이 지워질 수 있으니 주의하세요.</li>
                    <li>상대방이 작업을 마친 것이 확실하면 <b>[지금 데이터 고침]</b>을 눌러 상대방의 내용을 불러온 뒤 작업을 시작하세요.</li>
                </ul>
            </section>

            <section>
                <h3 className="font-bold text-lg text-gray-800 mb-2">3. 주요 기능 이용 방법</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border p-3 rounded bg-white">
                        <p className="font-bold text-sm mb-1 text-purple-600">제출 내역 입력</p>
                        <p className="text-xs text-gray-600">이용인을 검색하여 월별 서류(일정표, 주간보고 등) 제출 여부를 체크합니다.</p>
                    </div>
                    <div className="border p-3 rounded bg-white">
                        <p className="font-bold text-sm mb-1 text-purple-600">미제출 서류 조회</p>
                        <p className="text-xs text-gray-600">전체 명단에서 누락된 서류가 있는 이용인을 한눈에 파악합니다.</p>
                    </div>
                </div>
            </section>

            <section className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                <h3 className="font-bold text-lg text-purple-800 mb-2">4. 마무리: '저장 후 연동 종료' 클릭 필수</h3>
                <p className="text-sm leading-relaxed">
                    입력한 모든 내용은 반드시 초기 화면의 <b>[저장 후 연동 종료]</b> 버튼을 눌러야 실제 파일에 기록됩니다. <br/>
                    <b>저장과 동시에 파일 연동이 해제되며</b>, 나의 '접속 중' 상태가 해제되어 다른 동료가 안전하게 작업을 시작할 수 있습니다.
                </p>
            </section>

            <div className="flex justify-end pt-4 border-t">
                <button onClick={() => setIsHelpOpen(false)} className="bg-gray-800 text-white py-2 px-8 rounded-md hover:bg-gray-900 font-bold transition-colors">닫기</button>
            </div>
        </div>
      </Modal>
    </div>
  );
};
