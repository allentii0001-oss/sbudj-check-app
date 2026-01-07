import React, { useState } from 'react';
import type { Client, SupportWorker } from '../../types';
import { Modal } from './Modal';

export const SupportWorkerModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    client: Client | null;
    onSave: (clientId: string, workers: SupportWorker[]) => void;
}> = ({ isOpen, onClose, client, onSave }) => {
    const [workers, setWorkers] = useState<SupportWorker[]>([]);
    
    React.useEffect(() => {
        if(client) setWorkers(client.supportWorkers);
    }, [client]);

    if(!client) return null;

    const handleAddWorker = () => {
        setWorkers([...workers, { id: new Date().toISOString(), name: '', dob: '', servicePeriod: { start: '', end: '' } }]);
    };

    const handleWorkerChange = (index: number, field: keyof SupportWorker, value: any) => {
        const newWorkers = [...workers];
        if (field === 'servicePeriod') {
            newWorkers[index].servicePeriod = { ...newWorkers[index].servicePeriod, ...value };
        } else {
            (newWorkers[index] as any)[field] = value;
        }
        setWorkers(newWorkers);
    };

    const handleRemoveWorker = (id: string) => {
        setWorkers(workers.filter(w => w.id !== id));
    }
    
    const handleSave = () => {
        onSave(client.id, workers);
        onClose();
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`${client.name} - 활동지원사 관리`} size="3xl">
            <div className="space-y-4">
                {workers.map((worker, index) => (
                    <div key={worker.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 border p-4 rounded-md relative">
                        <button onClick={() => handleRemoveWorker(worker.id)} className="absolute top-2 right-2 text-red-500 hover:text-red-700">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">이름</label>
                            <input type="text" value={worker.name} onChange={(e) => handleWorkerChange(index, 'name', e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">생년월일</label>
                            <input type="date" value={worker.dob} onChange={(e) => handleWorkerChange(index, 'dob', e.target.value)} className="mt-1 block rounded-md border-gray-300 shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">계약일</label>
                            <input type="date" value={worker.servicePeriod.start} onChange={(e) => handleWorkerChange(index, 'servicePeriod', { start: e.target.value })} className="mt-1 block rounded-md border-gray-300 shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">해지일</label>
                            <input type="date" value={worker.servicePeriod.end} onChange={(e) => handleWorkerChange(index, 'servicePeriod', { end: e.target.value })} className="mt-1 block rounded-md border-gray-300 shadow-sm" />
                        </div>
                    </div>
                ))}
                <button onClick={handleAddWorker} className="w-full rounded-md border-2 border-dashed border-gray-300 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">활동지원사 추가</button>
            </div>
            <div className="flex justify-end pt-6">
                <button type="button" onClick={onClose} className="mr-2 rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">취소</button>
                <button type="button" onClick={handleSave} className="rounded-md border border-transparent bg-purple-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-purple-700">저장</button>
            </div>
        </Modal>
    );
}