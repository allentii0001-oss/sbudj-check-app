
import React, { useState, useMemo, useCallback } from 'react';
import type { Client, SubmissionData, PaymentItem, RetroactiveSubmissionStatus, WorkerSubmissionStatus } from '../types';
import { getMonthName, MONTHS, DOC_TYPES, normalizeDob, isWorkerActiveInMonth, isClientActiveInMonth, getSubmissionKey, isMatch } from '../utils/helpers';
import { DocumentDrawerModal } from './DocumentDrawerModal';

interface UnsubmittedViewProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  submissionData: SubmissionData;
  setSubmissionData: React.Dispatch<React.SetStateAction<SubmissionData>>;
  retroactiveData: PaymentItem[];
  allPayments: PaymentItem[];
  baseMonth: number;
  baseYear: number;
  retroactiveSubmissions: RetroactiveSubmissionStatus;
  setRetroactiveSubmissions: React.Dispatch<React.SetStateAction<RetroactiveSubmissionStatus>>;
  onBack: () => void;
}

type DocType = keyof typeof DOC_TYPES;

export const UnsubmittedView: React.FC<UnsubmittedViewProps> = ({ 
    clients, setClients, submissionData, setSubmissionData, retroactiveData, allPayments,
    baseMonth, baseYear, retroactiveSubmissions, setRetroactiveSubmissions, onBack 
}) => {
    const [showOnlyUnsubmitted, setShowOnlyUnsubmitted] = useState(false);
    const [clientSearch, setClientSearch] = useState('');
    const [workerSearch, setWorkerSearch] = useState('');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [initialTab, setInitialTab] = useState<number | undefined>(undefined);

    const sortedClients = useMemo(() => {
        return [...clients].sort((a, b) => a.name.localeCompare(b.name));
    }, [clients]);

    const handleCellClick = (client: Client, month: number) => {
        setInitialTab(month);
        setSelectedClient(client);
    };

    const handleNameClick = (client: Client) => {
        setInitialTab(baseMonth);
        setSelectedClient(client);
    };

    const handleCloseModal = () => {
        setSelectedClient(null);
        setInitialTab(undefined);
    };

    const getStatus = useCallback((client: Client, month: number, docType: DocType) => {
        // Updated Logic: Check if client is active in this month (considering multiple contract periods)
        const isActive = isClientActiveInMonth(client, month, baseYear);

        if (!isActive) {
            return { text: '미계약', color: 'bg-red-200 text-red-900', canClick: false };
        }

        if (month > baseMonth) {
             if (month === baseMonth + 1 && (docType === 'weeklyReport' || docType === 'retroactivePayment')) {
                return { text: '해당없음', color: 'bg-gray-200 text-gray-600', canClick: false };
            }
            if (month > baseMonth + 1) {
                 return { text: '해당없음', color: 'bg-gray-200 text-gray-600', canClick: false };
            }
        }

        const activeWorkers = client.supportWorkers.filter(worker => isWorkerActiveInMonth(worker, month, baseYear));
        if (activeWorkers.length === 0) {
            return { text: '지원사 X', color: 'bg-yellow-200 text-yellow-900', canClick: true };
        }

        const key = getSubmissionKey(client.id, baseYear, month);
        const monthStatus = submissionData[key];

        if (monthStatus?.noWork) {
            return { text: '근무없음', color: 'bg-yellow-100 text-yellow-800', canClick: true };
        }

        if (docType === 'retroactivePayment') {
            const workersWithRetro = activeWorkers.filter(w => 
                retroactiveData.some(item => {
                    // Check year from serviceStart if available
                    const itemYear = new Date(item.serviceStart).getFullYear();
                    // If invalid date, default to baseYear or skip check? Assuming valid date from parsing.
                    const isSameYear = !isNaN(itemYear) ? itemYear === baseYear : true;

                    return isSameYear &&
                    item.clientName === client.name && 
                    normalizeDob(item.clientDob) === normalizeDob(client.dob) && 
                    item.workerName === w.name && 
                    normalizeDob(item.workerDob) === normalizeDob(w.dob) &&
                    item.month === month
                })
            );
            
            if (workersWithRetro.length === 0) {
                return { text: '해당없음', color: 'bg-gray-200 text-gray-600', canClick: false };
            }
            
            const allSubmitted = workersWithRetro.every(w => 
                monthStatus?.workerSubmissions?.[w.id]?.retroactivePayment
            );
            
            return allSubmitted 
                ? { text: '유', color: 'bg-green-100 text-green-800', canClick: true }
                : { text: '무', color: 'bg-red-100 text-red-800', canClick: true };
        }

        const allSubmitted = activeWorkers.every(w =>
            monthStatus?.workerSubmissions?.[w.id]?.[docType as keyof import('../types').WorkerSubmissionStatus]
        );

        return allSubmitted
            ? { text: '유', color: 'bg-green-100 text-green-800', canClick: true }
            : { text: '무', color: 'bg-red-100 text-red-800', canClick: true };

    }, [submissionData, retroactiveData, baseMonth, baseYear]);

    const filteredClients = useMemo(() => {
        let result = sortedClients;
        
        if (clientSearch) {
            result = result.filter(c => isMatch(c.name, clientSearch));
        }

        if (workerSearch) {
            result = result.filter(c => c.supportWorkers.some(w => isMatch(w.name, workerSearch)));
        }

        if (showOnlyUnsubmitted) {
            result = result.filter(client => {
                return MONTHS.some(month => {
                    return Object.keys(DOC_TYPES).some(docType => {
                        const status = getStatus(client, month, docType as DocType);
                        return status.text === '무' || status.text === '지원사 X';
                    });
                });
            });
        }
        
        return result;
    }, [showOnlyUnsubmitted, sortedClients, getStatus, clientSearch, workerSearch]);

    // Submission Save Logic (Same as SubmissionInputView)
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
        <div className="p-4 sm:p-6 md:p-8 flex flex-col h-[calc(100vh-4rem)]">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4 space-y-4 md:space-y-0 flex-shrink-0">
                <div className="flex items-center">
                    <button onClick={onBack} className="text-purple-600 hover:text-purple-800 mr-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <h1 className="text-3xl font-bold text-gray-800">미제출 서류 조회 ({baseYear}년)</h1>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="이용인 이름 검색 (초성)" 
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            className="p-2 pl-8 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-sm"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="지원사 이름 검색 (초성)" 
                            value={workerSearch}
                            onChange={(e) => setWorkerSearch(e.target.value)}
                            className="p-2 pl-8 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-sm"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <label className="flex items-center space-x-2 cursor-pointer bg-white p-2 rounded-md border border-gray-300 shadow-sm">
                        <input type="checkbox" checked={showOnlyUnsubmitted} onChange={e => setShowOnlyUnsubmitted(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                        <span className="text-sm text-gray-700 font-medium">미제출만</span>
                    </label>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-md border border-gray-200 flex-1 overflow-hidden flex flex-col">
                <div className="overflow-auto flex-1 w-full relative">
                    <table className="min-w-full text-xs text-center border-collapse">
                        <thead className="bg-gray-100 sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th rowSpan={2} className="px-2 py-3 border border-gray-200 whitespace-nowrap bg-gray-100 z-30 sticky left-0 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">이용인 이름</th>
                                {MONTHS.map(month => (
                                    <th key={month} colSpan={3} className="px-2 py-3 border border-gray-200 bg-gray-100">{getMonthName(month)}</th>
                                ))}
                            </tr>
                            <tr>
                                {MONTHS.map(month => (
                                    <React.Fragment key={month}>
                                        {Object.values(DOC_TYPES).map(docName => (
                                            <th key={docName} className="px-2 py-2 border border-gray-200 font-normal min-w-[70px] bg-gray-100">{docName}</th>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClients.map(client => (
                                <tr key={client.id} className="hover:bg-gray-50">
                                    <td 
                                        onClick={() => handleNameClick(client)}
                                        className="px-2 py-2 border border-gray-200 font-medium whitespace-nowrap sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer hover:text-purple-600 hover:bg-purple-50 transition-colors"
                                    >
                                        {client.name}
                                    </td>
                                    {MONTHS.map(month => (
                                        <React.Fragment key={`${client.id}-${month}`}>
                                            {Object.keys(DOC_TYPES).map(docType => {
                                                const { text, color, canClick } = getStatus(client, month, docType as DocType);
                                                return (
                                                    <td 
                                                        key={`${client.id}-${month}-${docType}`} 
                                                        className={`px-1 py-2 border border-gray-200 ${canClick ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                                                        onClick={() => canClick && handleCellClick(client, month)}
                                                    >
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${color} block mx-auto w-fit whitespace-nowrap`}>{text}</span>
                                                    </td>
                                                );
                                            })}
                                        </React.Fragment>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredClients.length === 0 && (
                        <div className="text-center py-10 text-gray-500 absolute w-full mt-10">
                            {showOnlyUnsubmitted ? "미제출 내역이 없습니다." : "표시할 데이터가 없습니다."}
                        </div>
                    )}
                </div>
            </div>
            
            {selectedClient && (
                <DocumentDrawerModal
                    isOpen={!!selectedClient}
                    onClose={handleCloseModal}
                    client={selectedClient}
                    setClients={setClients}
                    submissionData={submissionData}
                    onSave={handleSaveSubmission}
                    retroactiveData={retroactiveData}
                    allPayments={allPayments}
                    retroactiveSubmissions={retroactiveSubmissions}
                    setRetroactiveSubmissions={setRetroactiveSubmissions}
                    baseYear={baseYear}
                    baseMonth={baseMonth}
                    initialTab={initialTab}
                />
            )}
        </div>
    );
};
