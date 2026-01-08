
import React, { useState, useMemo, useCallback } from 'react';
import type { Client, SubmissionData, RetroactivePaymentItem } from '../types';
import { getMonthName, MONTHS, DOC_TYPES, normalizeDob, isWorkerActiveInMonth, isClientActiveInMonth, getSubmissionKey } from '../utils/helpers';

interface UnsubmittedViewProps {
  clients: Client[];
  submissionData: SubmissionData;
  retroactiveData: RetroactivePaymentItem[];
  baseMonth: number;
  baseYear: number;
  onBack: () => void;
}

type DocType = keyof typeof DOC_TYPES;

export const UnsubmittedView: React.FC<UnsubmittedViewProps> = ({ clients, submissionData, retroactiveData, baseMonth, baseYear, onBack }) => {
    const [showOnlyUnsubmitted, setShowOnlyUnsubmitted] = useState(false);
    const [clientSearch, setClientSearch] = useState('');
    const [workerSearch, setWorkerSearch] = useState('');

    const sortedClients = useMemo(() => {
        return [...clients].sort((a, b) => a.name.localeCompare(b.name));
    }, [clients]);

    const getStatus = useCallback((client: Client, month: number, docType: DocType) => {
        // Updated Logic: Check if client is active in this month (considering multiple contract periods)
        const isActive = isClientActiveInMonth(client, month, baseYear);

        if (!isActive) {
            return { text: '미계약', color: 'bg-red-200 text-red-900' };
        }

        if (month > baseMonth) {
             if (month === baseMonth + 1 && (docType === 'weeklyReport' || docType === 'retroactivePayment')) {
                return { text: '해당없음', color: 'bg-gray-200 text-gray-600' };
            }
            if (month > baseMonth + 1) {
                 return { text: '해당없음', color: 'bg-gray-200 text-gray-600' };
            }
        }

        const activeWorkers = client.supportWorkers.filter(worker => isWorkerActiveInMonth(worker, month, baseYear));
        if (activeWorkers.length === 0) {
            return { text: '지원사 X', color: 'bg-yellow-200 text-yellow-900' };
        }

        const key = getSubmissionKey(client.id, baseYear, month);
        const monthStatus = submissionData[key];

        if (monthStatus?.noWork) {
            return { text: '근무없음', color: 'bg-yellow-100 text-yellow-800' };
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
                return { text: '해당없음', color: 'bg-gray-200 text-gray-600' };
            }
            
            const allSubmitted = workersWithRetro.every(w => 
                monthStatus?.workerSubmissions?.[w.id]?.retroactivePayment
            );
            
            return allSubmitted 
                ? { text: '유', color: 'bg-green-100 text-green-800' }
                : { text: '무', color: 'bg-red-100 text-red-800' };
        }

        const allSubmitted = activeWorkers.every(w =>
            monthStatus?.workerSubmissions?.[w.id]?.[docType as keyof import('../types').WorkerSubmissionStatus]
        );

        return allSubmitted
            ? { text: '유', color: 'bg-green-100 text-green-800' }
            : { text: '무', color: 'bg-red-100 text-red-800' };

    }, [submissionData, retroactiveData, baseMonth, baseYear]);

    const filteredClients = useMemo(() => {
        let result = sortedClients;
        
        if (clientSearch) {
            result = result.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
        }

        if (workerSearch) {
            result = result.filter(c => c.supportWorkers.some(w => w.name.toLowerCase().includes(workerSearch.toLowerCase())));
        }

        if (showOnlyUnsubmitted) {
            result = result.filter(client => {
                return MONTHS.some(month => {
                    return Object.keys(DOC_TYPES).some(docType => {
                        return getStatus(client, month, docType as DocType).text === '무';
                    });
                });
            });
        }
        
        return result;
    }, [showOnlyUnsubmitted, sortedClients, getStatus, clientSearch, workerSearch]);

    return (
        <div className="p-4 sm:p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 space-y-4 md:space-y-0">
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
                            placeholder="이용인 이름 검색" 
                            value={clientSearch}
                            onChange={(e) => setClientSearch(e.target.value)}
                            className="p-2 pl-8 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500 text-sm"
                        />
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="지원사 이름 검색" 
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

            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-center border-collapse">
                        <thead className="bg-gray-100 sticky top-0 z-10">
                            <tr>
                                <th rowSpan={2} className="px-2 py-3 border border-gray-200 whitespace-nowrap">이용인 이름</th>
                                {MONTHS.map(month => (
                                    <th key={month} colSpan={3} className="px-2 py-3 border border-gray-200">{getMonthName(month)}</th>
                                ))}
                            </tr>
                            <tr>
                                {MONTHS.map(month => (
                                    <React.Fragment key={month}>
                                        {Object.values(DOC_TYPES).map(docName => (
                                            <th key={docName} className="px-2 py-2 border border-gray-200 font-normal min-w-[70px]">{docName}</th>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredClients.map(client => (
                                <tr key={client.id} className="hover:bg-gray-50">
                                    <td className="px-2 py-2 border border-gray-200 font-medium whitespace-nowrap">{client.name}</td>
                                    {MONTHS.map(month => (
                                        <React.Fragment key={`${client.id}-${month}`}>
                                            {Object.keys(DOC_TYPES).map(docType => {
                                                const { text, color } = getStatus(client, month, docType as DocType);
                                                return (
                                                    <td key={`${client.id}-${month}-${docType}`} className={`px-1 py-2 border border-gray-200`}>
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
                </div>
                 {filteredClients.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                        {showOnlyUnsubmitted ? "미제출 내역이 없습니다." : "표시할 데이터가 없습니다."}
                    </div>
                )}
            </div>
        </div>
    );
};
