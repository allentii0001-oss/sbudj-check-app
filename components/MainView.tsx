import React, { useRef, useState } from 'react';
import type { ViewType } from '../types';
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
  // OneDrive Props
  clientId: string;
  setClientId: (id: string) => void;
  msalAccount: any;
  onCloudLogin: () => void;
  onCloudLogout: () => void;
  onCloudSave: () => void;
  onCloudLoad: () => void;
  isCloudLoading: boolean;
  // File System Access Props
  fileHandle: any;
  onConnectLocalFile: () => void;
  onDirectLocalSave: () => void;
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
const CloudIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const FolderIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>;
const LinkIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;
const HelpIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;

const YEARS = Array.from({ length: 7 }, (_, i) => 2024 + i);

export const MainView: React.FC<MainViewProps> = ({ 
    setView, baseMonth, setBaseMonth, baseYear, setBaseYear,
    onExportData, onImportData,
    clientId, setClientId, msalAccount, onCloudLogin, onCloudLogout, onCloudSave, onCloudLoad, isCloudLoading,
    fileHandle, onConnectLocalFile, onDirectLocalSave
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCloudSectionOpen, setIsCloudSectionOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4 relative">
      {/* Help Button */}
      <div className="absolute top-4 right-4">
        <button 
            onClick={() => setIsHelpOpen(true)}
            className="flex items-center space-x-1 text-gray-500 hover:text-purple-600 transition-colors bg-white px-3 py-2 rounded-full shadow-sm border border-gray-200"
        >
            <HelpIcon />
            <span className="text-sm font-medium">사용 설명서</span>
        </button>
      </div>

      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800">활동지원사 월별 서류 확인</h1>
        <p className="text-lg text-gray-600 mt-2">{baseYear}년 시스템</p>
        
        <div className="mt-8 flex flex-col items-center space-y-4">
            <div className="flex items-center space-x-2">
                <label htmlFor="baseYear" className="text-lg font-medium text-gray-700 w-24 text-right">기준 년도 :</label>
                <select
                    id="baseYear"
                    value={baseYear}
                    onChange={(e) => setBaseYear(Number(e.target.value))}
                    className="bg-white border border-gray-300 text-gray-900 text-lg rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2.5 min-w-[120px]"
                >
                    {YEARS.map(year => (
                        <option key={year} value={year}>
                            {year}년
                        </option>
                    ))}
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
                    {MONTHS.map(month => (
                        <option key={month} value={month}>
                            {getMonthName(month)}
                        </option>
                    ))}
                </select>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
        <Button onClick={() => setView('list')} icon={<ViewListIcon />}>
          전체 명단 보기
        </Button>
        <Button onClick={() => setView('input')} icon={<EditIcon />}>
          제출 내역 입력
        </Button>
        <Button onClick={() => setView('unsubmitted')} icon={<SearchIcon />}>
          미제출 서류 조회
        </Button>
        <Button onClick={() => setView('retroactive')} icon={<UploadIcon />}>
          소급결제 내역
        </Button>
      </div>

      {/* Main Data Management Section */}
      <div className="w-full max-w-2xl space-y-6">
        
        {/* 1. Recommended: Direct File Link (No Azure required) */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-purple-100">
            <div className="flex items-center mb-4">
                <div className="bg-purple-100 p-2 rounded-full mr-3 text-purple-600">
                    <FolderIcon />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">간편 파일 연동 (추천)</h3>
                    <p className="text-sm text-gray-500">PC의 원드라이브 폴더에 있는 파일을 직접 연결하여 자동 저장합니다.</p>
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
                            <span className="text-xs text-gray-400">(처음 한 번만 선택하면 이후엔 '저장' 버튼으로 즉시 반영됩니다)</span>
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
                        <span>지금 저장하기 (덮어쓰기)</span>
                    </button>
                    <button 
                        onClick={onConnectLocalFile}
                        className="bg-white border border-purple-200 text-purple-700 hover:bg-purple-50 font-medium py-3 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
                    >
                        <LoadIcon />
                        <span>다시 불러오기</span>
                    </button>
                </div>
            )}
        </div>

        {/* 2. Manual Export/Import */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-semibold text-gray-700">수동 파일 백업</h3>
            </div>
            <div className="flex space-x-3">
                <button 
                    onClick={onExportData}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors border border-gray-300"
                >
                    <SaveIcon />
                    <span>PC에 따로 저장 (다운로드)</span>
                </button>
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors border border-gray-300"
                >
                    <LoadIcon />
                    <span>PC 파일 불러오기</span>
                </button>
            </div>
            <input 
                type="file" 
                ref={fileInputRef}
                onChange={onImportData}
                accept=".json"
                className="hidden" 
            />
        </div>

        {/* 3. Advanced Cloud (Collapsible) */}
        <div className="border-t border-gray-200 pt-4">
            <button 
                onClick={() => setIsCloudSectionOpen(!isCloudSectionOpen)}
                className="flex items-center text-sm text-gray-500 hover:text-gray-700 w-full justify-center"
            >
                <CloudIcon />
                <span className="ml-2">고급: Microsoft 계정 직접 연동 (Azure 설정 필요)</span>
                <svg className={`w-4 h-4 ml-1 transform transition-transform ${isCloudSectionOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {isCloudSectionOpen && (
                <div className="mt-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                         <span className="text-xs text-gray-400">Azure Portal에서 Client ID를 발급받아야 사용 가능합니다.</span>
                         <button onClick={() => setIsSettingsOpen(true)} className="text-gray-400 hover:text-gray-600"><SettingsIcon /></button>
                    </div>

                     {!clientId ? (
                        <div className="text-center py-2">
                             <button onClick={() => setIsSettingsOpen(true)} className="text-blue-600 hover:underline text-sm">설정에서 Client ID 입력</button>
                        </div>
                    ) : !msalAccount ? (
                        <div className="text-center">
                            <button 
                                onClick={onCloudLogin}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors text-sm"
                            >
                                Microsoft 계정 로그인
                            </button>
                        </div>
                    ) : (
                        <div>
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-gray-600"><b>{msalAccount.name}</b></span>
                                <button onClick={onCloudLogout} className="text-xs text-red-500 hover:underline">로그아웃</button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button onClick={onCloudSave} disabled={isCloudLoading} className="bg-blue-500 text-white py-2 rounded text-sm flex justify-center items-center">
                                    {isCloudLoading ? "..." : "클라우드 저장"}
                                </button>
                                <button onClick={onCloudLoad} disabled={isCloudLoading} className="bg-green-500 text-white py-2 rounded text-sm flex justify-center items-center">
                                    {isCloudLoading ? "..." : "클라우드 불러오기"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
      </div>

      {/* Settings Modal */}
      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Azure 설정" size="md">
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Azure App Client ID</label>
                <input 
                    type="text" 
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="xxxx-xxxx-xxxx"
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-sm"
                />
            </div>
            <div className="flex justify-end">
                <button onClick={() => setIsSettingsOpen(false)} className="bg-purple-600 text-white py-2 px-4 rounded-md text-sm">확인</button>
            </div>
        </div>
      </Modal>

      {/* Help Modal */}
      <Modal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} title="사용 및 배포 가이드" size="3xl">
        <div className="space-y-6 text-gray-700">
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h3 className="font-bold text-lg text-blue-800 mb-2 flex items-center">
                    <span className="mr-2">🚀</span> 배포 방법 (링크 만들기)
                </h3>
                <p className="text-sm leading-relaxed mb-3">
                    팀원들이 접속할 수 있는 인터넷 주소를 만드는 방법입니다.
                </p>
                
                <div className="space-y-4">
                    <div className="bg-white p-3 rounded border border-blue-200">
                        <p className="font-semibold text-sm mb-1 text-blue-700">방법 1: Google Cloud (가장 쉬움)</p>
                        <p className="text-xs text-gray-600 mb-1">
                            화면 우측 상단의 <b>[Deploy]</b> 버튼을 누르고 안내를 따르면 됩니다.<br/>
                            카드 등록 절차가 있을 수 있으나, 소규모 사용은 비용이 거의 청구되지 않습니다.
                        </p>
                    </div>

                    <div className="bg-white p-3 rounded border border-blue-200">
                        <p className="font-semibold text-sm mb-1 text-blue-700">방법 2: Netlify (평생 무료 / 추천)</p>
                        <p className="text-xs text-gray-600 mb-2">
                            화면의 버튼으로 바로 배포할 수 없습니다. 수동으로 진행해야 합니다.
                        </p>
                        <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1 ml-1">
                            <li>현재 화면의 프로젝트 메뉴에서 <b>[Download]</b>를 눌러 코드를 내 컴퓨터에 저장합니다.</li>
                            <li>다운로드한 파일을 <b>GitHub</b>(깃허브) 저장소에 올립니다.</li>
                            <li><b>Netlify</b>(넷리파이) 사이트에 가입 후 "Import from GitHub"를 선택합니다.</li>
                            <li>GitHub에 올린 저장소를 선택하면 무료 주소가 생성됩니다.</li>
                        </ol>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="font-bold text-lg text-gray-800 mb-2 flex items-center">
                    <span className="mr-2">👥</span> 팀원들과 같이 사용하는 법
                </h3>
                <div className="space-y-4">
                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <p className="font-semibold text-sm mb-1">1단계: 링크 공유 (앱 설치)</p>
                        <p className="text-sm text-gray-600">위의 배포 과정으로 만든 인터넷 주소를 팀원들에게 카톡으로 보내주세요.</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded border border-gray-200">
                        <p className="font-semibold text-sm mb-1">2단계: 데이터 공유 (원드라이브)</p>
                        <p className="text-sm text-gray-600">
                            PC의 <b>공유 원드라이브 폴더</b>에 데이터 파일(.json)을 하나 넣어두세요.<br/>
                            모든 팀원이 앱을 켜고 <b>[간편 파일 연동]</b>에서 그 공유 파일을 선택하면 됩니다.
                        </p>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="font-bold text-lg text-red-600 mb-2 flex items-center">
                    <span className="mr-2">⚠️</span> 주의사항 (데이터 덮어쓰기 방지)
                </h3>
                <p className="text-sm leading-relaxed mb-2 bg-red-50 p-3 rounded border border-red-100">
                    이 앱은 실시간 자동 동기화(구글 닥스 방식)가 아닙니다.<br/>
                    <b>반드시 아래 순서를 지켜주세요!</b>
                </p>
                <ol className="list-decimal list-inside text-sm space-y-2 ml-2 font-medium">
                    <li>입력 시작 전에 반드시 <span className="text-blue-600">[다시 불러오기]</span> 버튼을 누른다.</li>
                    <li>내용을 수정/입력한다.</li>
                    <li>입력이 끝나면 즉시 <span className="text-purple-600">[지금 저장하기]</span>를 누른다.</li>
                </ol>
            </div>
            
             <div className="flex justify-end pt-4 border-t">
                <button onClick={() => setIsHelpOpen(false)} className="bg-gray-800 text-white py-2 px-6 rounded-md hover:bg-gray-900">닫기</button>
            </div>
        </div>
      </Modal>
    </div>
  );
};