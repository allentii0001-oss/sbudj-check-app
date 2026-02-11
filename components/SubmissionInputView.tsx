
import React, { useState, useMemo } from 'react';
import type { Client, SubmissionData, PaymentItem, WorkerSubmissionStatus, RetroactiveSubmissionStatus } from '../types';
import { getSubmissionKey, isMatch } from '../utils/helpers';
import { DocumentDrawerModal } from './DocumentDrawerModal';

// Main View Component
export const SubmissionInputView: React.FC<{
    clients: Client[];
    setClients: React.Dispatch<React.SetStateAction<Client[]>>;
    submissionData: SubmissionData;
    setSubmissionData: React.Dispatch<React.SetStateAction<SubmissionData>>;
    retroactiveData: PaymentItem[];
    allPayments: PaymentItem[];
    retroactiveSubmissions: RetroactiveSubmissionStatus;
    setRetroactiveSubmissions: React.Dispatch<React.SetStateAction<RetroactiveSubmissionStatus>>;
    onBack: () => void;
    baseYear: number;
    baseMonth: number;
    // Deprecated
    retroactiveHashes?: any;
    setRetroactiveHashes?: any;
}> = ({ clients, setClients, submissionData, setSubmissionData, retroactiveData, allPayments, retroactiveSubmissions, setRetroactiveSubmissions, onBack, baseYear, baseMonth }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    // Removed local storage based savedBaseMonth logic. Relying purely on props.

    const filteredClients = useMemo(() => {
        if (!searchTerm) return [];
        return clients.filter(c => isMatch(c.name, searchTerm));
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
                placeholder="이용인 이름 검색 (초성 가능)..."
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
            allPayments={allPayments}
            retroactiveSubmissions={retroactiveSubmissions}
            setRetroactiveSubmissions={setRetroactiveSubmissions}
            baseYear={baseYear}
            baseMonth={baseMonth}
        />
      )}
    </div>
    );
};
