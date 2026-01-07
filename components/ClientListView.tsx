
import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { Client, SupportWorker, ContractPeriod } from '../types';
import { Modal } from './common/Modal';
import { SupportWorkerModal } from './common/SupportWorkerModal';

interface ClientListViewProps {
  clients: Client[];
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  onBack: () => void;
}

declare const XLSX: any;

const ClientFormModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (client: Client) => void;
    client: Client | null;
}> = ({ isOpen, onClose, onSave, client }) => {
    const [name, setName] = useState('');
    const [dob, setDob] = useState('');
    const [familySupport, setFamilySupport] = useState(false);
    
    // Contract History Management
    const [contractPeriods, setContractPeriods] = useState<ContractPeriod[]>([]);

    useEffect(() => {
        if (client) {
            setName(client.name);
            setDob(client.dob);
            setFamilySupport(client.familySupport);
            
            // Initialize periods from history or fallback to current start/end
            if (client.contractHistory && client.contractHistory.length > 0) {
                setContractPeriods(client.contractHistory);
            } else {
                setContractPeriods([{ start: client.contractStart, end: client.contractEnd }]);
            }
        } else {
            setName('');
            setDob('');
            setFamilySupport(false);
            setContractPeriods([{ start: '', end: '' }]);
        }
    }, [client, isOpen]);

    const handlePeriodChange = (index: number, field: keyof ContractPeriod, value: string) => {
        const newPeriods = [...contractPeriods];
        newPeriods[index] = { ...newPeriods[index], [field]: value };
        setContractPeriods(newPeriods);
    };

    const addPeriod = () => {
        setContractPeriods([...contractPeriods, { start: '', end: '' }]);
    };

    const removePeriod = (index: number) => {
        if (contractPeriods.length > 1) {
            setContractPeriods(contractPeriods.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Process periods: Sort by start date, fill empty ends with 2099-12-31
        const processedPeriods = contractPeriods.map(p => ({
            start: p.start,
            end: p.end ? p.end : '2099-12-31'
        })).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

        // The latest period determines the main display fields
        const latestPeriod = processedPeriods[processedPeriods.length - 1];

        const newClient: Client = {
            id: client?.id || new Date().toISOString(),
            name,
            dob,
            contractStart: latestPeriod.start,
            contractEnd: latestPeriod.end,
            contractHistory: processedPeriods,
            supportWorkers: client?.supportWorkers || [],
            familySupport
        };
        onSave(newClient);
        onClose();
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={client ? '이용인 정보 수정' : '신규 이용인 추가'}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">이름</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm" required />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">생년월일</label>
                    <input type="date" value={dob} max="9999-12-31" onChange={e => setDob(e.target.value)} className="mt-1 block rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm" required />
                </div>
                
                <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-bold text-gray-700">계약 기간 관리</label>
                        <button type="button" onClick={addPeriod} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200">
                            + 기간 추가
                        </button>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {contractPeriods.map((period, index) => (
                            <div key={index} className="flex items-center space-x-2">
                                <span className="text-xs text-gray-500 w-6">{index + 1}차</span>
                                <input 
                                    type="date" 
                                    value={period.start} 
                                    max="9999-12-31"
                                    onChange={e => handlePeriodChange(index, 'start', e.target.value)} 
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-xs py-1" 
                                    required 
                                />
                                <span className="text-gray-400">~</span>
                                <input 
                                    type="date" 
                                    value={period.end} 
                                    max="9999-12-31"
                                    onChange={e => handlePeriodChange(index, 'end', e.target.value)} 
                                    placeholder="종료일 (비워두면 계속)"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 text-xs py-1" 
                                />
                                {contractPeriods.length > 1 && (
                                    <button type="button" onClick={() => removePeriod(index)} className="text-red-500 hover:text-red-700">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">* 종료일이 비어있으면 자동으로 2099-12-31(계속 계약)로 저장됩니다.</p>
                </div>

                <div className="flex items-center">
                    <input type="checkbox" checked={familySupport} onChange={e => setFamilySupport(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                    <label className="ml-2 block text-sm text-gray-900">가족지원</label>
                </div>
                <div className="flex justify-end pt-4">
                    <button type="button" onClick={onClose} className="mr-2 rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">취소</button>
                    <button type="submit" className="rounded-md border border-transparent bg-purple-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-purple-700">저장</button>
                </div>
            </form>
        </Modal>
    );
};

export const ClientListView: React.FC<ClientListViewProps> = ({ clients, setClients, onBack }) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const sortedClients = useMemo(() => {
        return [...clients].sort((a, b) => a.name.localeCompare(b.name));
    }, [clients]);

    const handleAddClient = () => {
        setSelectedClient(null);
        setIsFormModalOpen(true);
    };
    
    const handleEditClient = (client: Client) => {
        setSelectedClient(client);
        setIsFormModalOpen(true);
    };

    const handleManageWorkers = (client: Client) => {
        setSelectedClient(client);
        setIsWorkerModalOpen(true);
    };

    const handleSaveClient = (clientData: Client) => {
        const index = clients.findIndex(c => c.id === clientData.id);
        if (index > -1) {
            const newClients = [...clients];
            newClients[index] = clientData;
            setClients(newClients);
        } else {
            setClients([...clients, clientData]);
        }
    };
    
    const handleSaveWorkers = (clientId: string, workers: SupportWorker[]) => {
        setClients(prevClients => prevClients.map(c => c.id === clientId ? { ...c, supportWorkers: workers } : c));
    };

    const handleDeleteClient = (clientId: string) => {
        if(window.confirm("정말로 이 이용인을 삭제하시겠습니까?")) {
            setClients(clients.filter(c => c.id !== clientId));
        }
    };

    const handleDownload = () => {
        if (!clients.length) {
            alert("다운로드할 데이터가 없습니다.");
            return;
        }

        const dataToExport = clients.map(client => ({
            id: client.id,
            name: client.name,
            dob: client.dob,
            contractStart: client.contractStart,
            contractEnd: client.contractEnd,
            familySupport: client.familySupport,
            supportWorkers: JSON.stringify(client.supportWorkers, null, 2),
            contractHistory: client.contractHistory ? JSON.stringify(client.contractHistory) : ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');

        worksheet['!cols'] = [
            { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
            { wch: 15 }, { wch: 12 }, { wch: 100 }, { wch: 50 }
        ];
        
        XLSX.writeFile(workbook, 'clients_data.xlsx');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json: any[] = XLSX.utils.sheet_to_json(sheet);

                const newClients: Client[] = json.map((row: any, index: number) => {
                    try {
                        if (!row.name || !row.dob || !row.contractStart || !row.contractEnd) {
                            throw new Error(`필수 필드(name, dob, contractStart, contractEnd)가 없습니다.`);
                        }
                        
                        const supportWorkers = row.supportWorkers ? JSON.parse(row.supportWorkers) : [];
                        const contractHistory = row.contractHistory ? JSON.parse(row.contractHistory) : [{ start: row.contractStart, end: row.contractEnd }];

                        return {
                            id: row.id || `${Date.now()}-${index}`,
                            name: String(row.name),
                            dob: String(row.dob),
                            contractStart: String(row.contractStart),
                            contractEnd: String(row.contractEnd),
                            familySupport: !!row.familySupport,
                            supportWorkers: Array.isArray(supportWorkers) ? supportWorkers : [],
                            contractHistory: Array.isArray(contractHistory) ? contractHistory : []
                        };
                    } catch (err: any) {
                        throw new Error(`Row ${index + 2} 처리 중 오류: ${err.message}`);
                    }
                });
                
                if (newClients.length > 0) {
                    if (window.confirm(`파일에서 ${newClients.length}명의 이용인 정보를 찾았습니다. 기존의 모든 데이터를 대체하시겠습니까?`)) {
                        setClients(newClients);
                        alert('명단이 성공적으로 업데이트되었습니다.');
                    }
                } else {
                    alert('파일에서 유효한 이용인 정보를 찾을 수 없습니다.');
                }
            } catch (err: any) {
                console.error(err);
                alert(`파일 처리 중 오류가 발생했습니다: ${err.message}`);
            } finally {
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        };
        reader.onerror = () => {
            alert('파일을 읽는 중 오류가 발생했습니다.');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };
    
    return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
            <button onClick={onBack} className="text-purple-600 hover:text-purple-800 mr-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h1 className="text-3xl font-bold text-gray-800">전체 명단 보기</h1>
        </div>
        <div className="flex items-center space-x-2">
            <button onClick={handleDownload} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                <span>다운로드</span>
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <span>업로드</span>
            </button>
            <button onClick={handleAddClient} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                <span>신규 이용인</span>
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-100">
              <tr>
                <th scope="col" className="px-6 py-3">연번</th>
                <th scope="col" className="px-6 py-3">이름</th>
                <th scope="col" className="px-6 py-3">생년월일</th>
                <th scope="col" className="px-6 py-3">최근 계약 시작</th>
                <th scope="col" className="px-6 py-3">최근 계약 종료</th>
                <th scope="col" className="px-6 py-3 text-center">활동지원사</th>
                <th scope="col" className="px-6 py-3 text-center">가족지원</th>
                <th scope="col" className="px-6 py-3">관리</th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map((client, index) => (
                <tr key={client.id} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4">{index + 1}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">{client.name}</td>
                  <td className="px-6 py-4">{client.dob}</td>
                  <td className="px-6 py-4">{client.contractStart}</td>
                  <td className="px-6 py-4">{client.contractEnd === '2099-12-31' ? '(계속)' : client.contractEnd}</td>
                  <td className="px-6 py-4 text-center">
                      <button onClick={() => handleManageWorkers(client)} className="text-purple-600 hover:underline">
                          {client.supportWorkers.length}명
                      </button>
                  </td>
                  <td className="px-6 py-4 text-center">{client.familySupport ? '유' : '무'}</td>
                  <td className="px-6 py-4 space-x-2">
                    <button onClick={() => handleEditClient(client)} className="font-medium text-blue-600 hover:underline">수정</button>
                    <button onClick={() => handleDeleteClient(client.id)} className="font-medium text-red-600 hover:underline">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <ClientFormModal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} onSave={handleSaveClient} client={selectedClient} />
      <SupportWorkerModal isOpen={isWorkerModalOpen} onClose={() => setIsWorkerModalOpen(false)} client={selectedClient} onSave={handleSaveWorkers} />
    </div>
    );
};