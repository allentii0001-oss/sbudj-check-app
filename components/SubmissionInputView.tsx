
import React, { useState, useMemo } from 'react';
import type { Client, SubmissionData, RetroactivePaymentItem, WorkerSubmissionStatus, SupportWorker, RetroactiveSubmissionStatus } from '../types';
import { Modal } from './common/Modal';
import { getMonthName, MONTHS, normalizeDob, isWorkerActiveInMonth, DOC_TYPES, formatDobToYYMMDD, formatDateTime, isClientActiveInMonth, getSubmissionKey } from '../utils/helpers';
import { SupportWorkerModal } from './common/SupportWorkerModal';

const RetroactiveDetailModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  items: RetroactivePaymentItem[];
  clientName: string;
  month: number;
  checkedItems: RetroactiveSubmissionStatus;
  onItemCheck: (itemId: string, isChecked: boolean) => void;
  activeWorkers: SupportWorker[];
}> = ({ isOpen, onClose, items, clientName, month, checkedItems, onItemCheck, activeWorkers }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${clientName} - ${getMonthName(month)} 소급결제 내역`}
      size="5xl"
    >
      <div className="overflow-x-auto max-h-[60vh]">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
            <tr>
              <th scope="col" className="px-4 py-3 w-12 text-center">제출</th>
              <th scope="col" className="px-4 py-3">활동지원사 이름</th>
              <th scope="col" className="px-4 py-3">활동지원사 생년월일</th>
              <th scope="col" className="px-4 py-3">서비스 시작</th>
              <th scope="col" className="px-4 py-3">서비스 종료</th>
            </tr>
          </thead>
          <tbody>
            {items.length > 0 ? (
              items.map((item) => {
                const isWorkerMatched = activeWorkers.some(worker => 
                    worker.name === item.workerName && 
                    normalizeDob(worker.dob) === normalizeDob(item.workerDob)
                );
                return (
                    <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-4 py-4 text-center">
                        <input
                        type="checkbox"
                        checked={!!checkedItems[item.id]}
                        onChange={(e) => onItemCheck(item.id, e.target.checked)}
                        disabled={!isWorkerMatched}
                        className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:bg-gray-200 disabled:cursor-not-allowed"
                        />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">{item.workerName}</td>
                    <td className="px-4 py-4 whitespace-nowrap">{formatDobToYYMMDD(item.workerDob)}</td>
                    <td className="px-4 py-4 whitespace-nowrap">{formatDateTime(item.serviceStart)}</td>
                    <td className="px-4 py-4 whitespace-nowrap">{formatDateTime(item.serviceEnd)}</td>
                    </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-500">
                  해당 월에 일치하는 소급결제 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
       <div className="flex justify-end pt-4 mt-4 border-t">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">닫기</button>
      </div>
    </Modal>
  );
};


// DocumentDrawerModal component
const DocumentDrawerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    client: Client;
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    submissionData: SubmissionData;
    onSave: (clientId: string, year: number, month: number, update: { workerId?: string; docType?: keyof WorkerSubmissionStatus; value?: boolean; noWork?: boolean }) => void;
    retroactiveData: RetroactivePaymentItem[];
    retroactiveSubmissions: RetroactiveSubmissionStatus;
    setRetroactiveSubmissions: React.Dispatch<React.SetStateAction<RetroactiveSubmissionStatus>>;
    baseYear: number;
}> = ({ isOpen, onClose, client, setClients, submissionData, onSave, retroactiveData, retroactiveSubmissions, setRetroactiveSubmissions, baseYear }) => {
    const [activeTab, setActiveTab] = useState(new Date().getMonth());
    const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
    const [isRetroDetailModalOpen, setIsRetroDetailModalOpen] = useState(false);
    const [retroItemsForDetail, setRetroItemsForDetail] = useState<RetroactivePaymentItem[]>([]);

    const getInitialWorkerStatus = (): WorkerSubmissionStatus => ({ schedule: false, weeklyReport: false, retroactivePayment: false });

    const activeWorkers = useMemo(() => {
        return client.supportWorkers.filter(worker => isWorkerActiveInMonth(worker, activeTab, baseYear));
    }, [client.supportWorkers, activeTab, baseYear]);
    
    const handleShowRetroDetails = () => {
        const relevantItems = retroactiveData.filter(item => 
            item.clientName === client.name &&
            normalizeDob(item.clientDob) === normalizeDob(client.dob) &&
            item.month === activeTab
        );
        setRetroItemsForDetail(relevantItems);
        setIsRetroDetailModalOpen(true);
    };

    const handleWorkerStatusChange = (workerId: string, docType: keyof WorkerSubmissionStatus, value: boolean) => {
        onSave(client.id, baseYear, activeTab, { workerId, docType, value });
    };

    const handleNoWorkChange = (value: boolean) => {
        onSave(client.id, baseYear, activeTab, { noWork: value });
    };

    const handleSaveWorkers = (clientId: string, workers: SupportWorker[]) => {
        setClients(prevClients => prevClients.map(c => c.id === clientId ? { ...c, supportWorkers: workers } : c));
    };

    const handleRetroItemCheck = (itemId: string, isChecked: boolean) => {
      setRetroactiveSubmissions(prev => {
        const newRetroSubmissions = { ...prev, [itemId]: isChecked };

        activeWorkers.forEach(worker => {
            const workerRetroItems = retroactiveData.filter(item =>
                item.clientName === client.name &&
                normalizeDob(item.clientDob) === normalizeDob(client.dob) &&
                item.workerName === worker.name &&
                normalizeDob(item.workerDob) === normalizeDob(worker.dob) &&
                item.month === activeTab
            );

            if (workerRetroItems.length > 0) {
                const areAllItemsChecked = workerRetroItems.every(item => newRetroSubmissions[item.id]);
                
                const key = getSubmissionKey(client.id, baseYear, activeTab);
                const currentSubmissionStatus = submissionData[key]?.workerSubmissions?.[worker.id]?.retroactivePayment ?? false;

                if (currentSubmissionStatus !== areAllItemsChecked) {
                    onSave(client.id, baseYear, activeTab, { workerId: worker.id, docType: 'retroactivePayment', value: areAllItemsChecked });
                }
            }
        });

        return newRetroSubmissions;
      });
    };

    const getApplicability = (month: number) => {
        const isActive = isClientActiveInMonth(client, month, baseYear);
        return isActive ? 'applicable' : '해당없음 (계약 기간 외)';
    };

    if (!isOpen) return null;

    const key = getSubmissionKey(client.id, baseYear, activeTab);
    const monthStatus = submissionData[key] || { noWork: false, workerSubmissions: {} };
    const applicability = getApplicability(activeTab);
    const isApplicable = applicability === 'applicable';
    
    return (
    <>
        <Modal isOpen={isOpen} onClose={onClose} title={`${client.name} - 서류 서랍 (${baseYear}년)`} size="4xl">
            <div className="flex border-b border-gray-200 overflow-x-auto">
                {MONTHS.map(month => (
                    <button
                        key={month}
                        onClick={() => setActiveTab(month)}
                        className={`py-2 px-4 text-sm font-medium whitespace-nowrap ${activeTab === month ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {getMonthName(month)}
                    </button>
                ))}
            </div>
            <div className="p-6 min-h-[20rem]">
                {isApplicable ? (
                    <>
                        {activeWorkers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <p className="text-red-600 font-semibold mb-4">해당 월에 배정된 활동지원사가 없습니다.</p>
                                <button onClick={() => setIsWorkerModalOpen(true)} className="bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600">
                                    활동지원사 등록 오류
                                </button>
                            </div>
                        ) : (
                             <div className="space-y-6">
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse text-center">
                                        <thead>
                                            <tr className="bg-gray-50">
                                                <th className="p-3 font-semibold text-gray-600 border-b-2 border-gray-200 text-left">서류</th>
                                                {activeWorkers.map(worker => (
                                                    <th key={worker.id} className="p-3 font-semibold text-gray-600 border-b-2 border-gray-200 whitespace-nowrap">
                                                        {worker.name}
                                                        <div className="text-xs font-normal text-gray-500">{worker.dob}</div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(Object.keys(DOC_TYPES) as Array<keyof WorkerSubmissionStatus>).map(docType => {
                                                const hasAnyRetroItemForClientThisMonth = retroactiveData.some(item => 
                                                    item.clientName === client.name &&
                                                    normalizeDob(item.clientDob) === normalizeDob(client.dob) &&
                                                    item.month === activeTab
                                                );

                                                return (
                                                    <tr key={docType} className="hover:bg-gray-50">
                                                        <td className="p-3 border-b border-gray-200 text-left">
                                                            {docType === 'retroactivePayment' ? (
                                                                hasAnyRetroItemForClientThisMonth ? (
                                                                    <button onClick={handleShowRetroDetails} className="text-purple-600 hover:underline font-medium">
                                                                        {DOC_TYPES[docType]}
                                                                    </button>
                                                                ) : (
                                                                    <span className="font-medium text-gray-400">{DOC_TYPES[docType]}</span>
                                                                )
                                                            ) : (
                                                                <span className="font-medium text-gray-700">{DOC_TYPES[docType]}</span>
                                                            )}
                                                        </td>
                                                        {activeWorkers.map(worker => {
                                                            const workerStatus = monthStatus.workerSubmissions[worker.id] || getInitialWorkerStatus();
                                                            const hasRetroItemForThisWorker = retroactiveData.some(item => 
                                                                item.clientName === client.name &&
                                                                normalizeDob(item.clientDob) === normalizeDob(client.dob) &&
                                                                item.workerName === worker.name &&
                                                                normalizeDob(item.workerDob) === normalizeDob(worker.dob) &&
                                                                item.month === activeTab
                                                            );
                                                            const isDisabled = monthStatus.noWork || (docType === 'retroactivePayment' && !hasRetroItemForThisWorker);
                                                            
                                                            return (
                                                                <td key={`${docType}-${worker.id}`} className="p-3 border-b border-gray-200">
                                                                    <input 
                                                                        type="checkbox" 
                                                                        checked={workerStatus[docType]} 
                                                                        onChange={e => handleWorkerStatusChange(worker.id, docType, e.target.checked)} 
                                                                        className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 disabled:bg-gray-200" 
                                                                        disabled={isDisabled} 
                                                                    />
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                                <hr className="my-6"/>
                                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md">
                                <span className="text-gray-700 font-semibold">근무없음 (해당 월 전체)</span>
                                <input type="checkbox" checked={monthStatus.noWork} onChange={e => handleNoWorkChange(e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                            </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-lg text-gray-500">{applicability}</p>
                    </div>
                )}
            </div>
        </Modal>
        <RetroactiveDetailModal
            isOpen={isRetroDetailModalOpen}
            onClose={() => setIsRetroDetailModalOpen(false)}
            items={retroItemsForDetail}
            clientName={client.name}
            month={activeTab}
            checkedItems={retroactiveSubmissions}
            onItemCheck={handleRetroItemCheck}
            activeWorkers={activeWorkers}
        />
        {isWorkerModalOpen && (
            <SupportWorkerModal
                isOpen={isWorkerModalOpen}
                onClose={() => setIsWorkerModalOpen(false)}
                client={client}
                onSave={handleSaveWorkers}
            />
        )}
     </>
    );
};


// Main View Component
export const SubmissionInputView: React.FC<{
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    submissionData: SubmissionData;
    setSubmissionData: React.Dispatch<React.SetStateAction<SubmissionData>>;
    retroactiveData: RetroactivePaymentItem[];
    retroactiveSubmissions: RetroactiveSubmissionStatus;
    setRetroactiveSubmissions: React.Dispatch<React.SetStateAction<RetroactiveSubmissionStatus>>;
    onBack: () => void;
    baseYear: number;
    // Deprecated, for type compatibility
    retroactiveHashes?: any;
    setRetroactiveHashes?: any;
}> = ({ clients, setClients, submissionData, setSubmissionData, retroactiveData, retroactiveSubmissions, setRetroactiveSubmissions, onBack, baseYear }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    const filteredClients = useMemo(() => {
        if (!searchTerm) return [];
        return clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [searchTerm, clients]);

    const handleSelectClient = (client: Client) => {
        setSelectedClient(client);
        setSearchTerm('');
    };

    const handleSaveSubmission = (
        clientId: string, 
        year: number,
        month: number, 
        update: { workerId?: string; docType?: keyof WorkerSubmissionStatus; value?: boolean; noWork?: boolean }
    ) => {
        const key = getSubmissionKey(clientId, year, month);
        setSubmissionData(prev => {
            const newSubmissionData = JSON.parse(JSON.stringify(prev)); // Deep copy
            const currentMonthData = newSubmissionData[key] || { noWork: false, workerSubmissions: {} };

            if (update.noWork !== undefined) {
                currentMonthData.noWork = update.noWork;
                // If setting noWork to true, uncheck all worker submissions for that month
                if (update.noWork) {
                    Object.keys(currentMonthData.workerSubmissions).forEach(workerId => {
                         currentMonthData.workerSubmissions[workerId] = { schedule: false, weeklyReport: false, retroactivePayment: false };
                    });
                }
            }

            if (update.workerId && update.docType && update.value !== undefined) {
                const currentWorkerData = currentMonthData.workerSubmissions[update.workerId] || { schedule: false, weeklyReport: false, retroactivePayment: false };
                currentWorkerData[update.docType] = update.value;
                currentMonthData.workerSubmissions[update.workerId] = currentWorkerData;
            }

            newSubmissionData[key] = currentMonthData;
            return newSubmissionData;
        });
    };

    return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="text-purple-600 hover:text-purple-800 mr-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-3xl font-bold text-gray-800">제출 내역 입력 ({baseYear}년)</h1>
      </div>
      
      <div className="max-w-2xl mx-auto">
        <div className="relative">
            <input 
                type="text"
                placeholder="이용인 이름 검색..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full p-3 pr-10 text-lg border-2 border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>

        {searchTerm && filteredClients.length > 0 && (
            <div className="bg-white border border-gray-300 rounded-lg mt-2 shadow-lg max-h-60 overflow-y-auto z-50 relative">
                <ul>
                    {filteredClients.map(client => (
                        <li key={client.id} onClick={() => handleSelectClient(client)} className="p-3 cursor-pointer hover:bg-purple-50 border-b">
                            {client.name} ({client.dob})
                        </li>
                    ))}
                </ul>
            </div>
        )}

        {searchTerm && filteredClients.length === 0 && (
            <p className="text-center text-gray-500 mt-4">검색 결과가 없습니다.</p>
        )}
      </div>
      
      {selectedClient && (
        <DocumentDrawerModal
            isOpen={!!selectedClient}
            onClose={() => setSelectedClient(null)}
            client={selectedClient}
            setClients={setClients}
            submissionData={submissionData}
            onSave={handleSaveSubmission}
            retroactiveData={retroactiveData}
            retroactiveSubmissions={retroactiveSubmissions}
            setRetroactiveSubmissions={setRetroactiveSubmissions}
            baseYear={baseYear}
        />
      )}
    </div>
    );
};
