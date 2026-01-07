
import React, { useState } from 'react';
import type { RetroactivePaymentItem } from '../types';
import { normalizeDob } from '../utils/helpers';

interface RetroactivePaymentViewProps {
  retroactiveData: RetroactivePaymentItem[];
  setRetroactiveData: React.Dispatch<React.SetStateAction<RetroactivePaymentItem[]>>;
  onBack: () => void;
}

declare const XLSX: any;

export const RetroactivePaymentView: React.FC<RetroactivePaymentViewProps> = ({ retroactiveData, setRetroactiveData, onBack }) => {
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsLoading(true);
    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, {
          header: ["clientName", "clientDob", "serviceStart", "serviceEnd", "workerName", "workerDob"],
          range: 1, // Skip header row
        });

        const formattedData: RetroactivePaymentItem[] = json.map((row: any, index: number) => {
          if (!row.clientName || !row.serviceStart) {
            return null;
          }

          const serviceStartDate = new Date(row.serviceStart);
          if (isNaN(serviceStartDate.getTime())) {
              console.warn(`Skipping row due to invalid serviceStart date:`, row);
              return null;
          }
          const month = serviceStartDate.getMonth(); // 0-11
          
          const clientDobNormalized = normalizeDob(row.clientDob);
          const workerDobNormalized = normalizeDob(row.workerDob);

          const itemContent = JSON.stringify({
            clientName: String(row.clientName || ''),
            clientDob: clientDobNormalized,
            serviceStart: String(row.serviceStart || ''),
            serviceEnd: String(row.serviceEnd || ''),
            workerName: String(row.workerName || ''),
            workerDob: workerDobNormalized
          });
          
          // Simple hash for ID
          let hash = 0;
          for (let i = 0; i < itemContent.length; i++) {
              const char = itemContent.charCodeAt(i);
              hash = ((hash << 5) - hash) + char;
              hash |= 0; 
          }

          return {
            id: String(hash + index),
            clientName: String(row.clientName || ''),
            clientDob: clientDobNormalized,
            serviceStart: String(row.serviceStart || ''),
            serviceEnd: String(row.serviceEnd || ''),
            workerName: String(row.workerName || ''),
            workerDob: workerDobNormalized,
            month,
          };
        }).filter((item: RetroactivePaymentItem | null): item is RetroactivePaymentItem => item !== null);
        
        setRetroactiveData(formattedData);
      } catch (err) {
        console.error(err);
        setError('파일을 파싱하는 중 오류가 발생했습니다. 올바른 엑셀 파일인지 확인해주세요.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.onerror = () => {
        setError('파일을 읽는 중 오류가 발생했습니다.');
        setIsLoading(false);
    }
    reader.readAsBinaryString(file);
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="flex items-center mb-6">
        <button onClick={onBack} className="text-purple-600 hover:text-purple-800 mr-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="text-3xl font-bold text-gray-800">소급결제 내역</h1>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">엑셀 파일 업로드</h2>
        <div className="flex items-center space-x-4">
          <label className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg cursor-pointer transition-colors">
            <span>파일 선택</span>
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
          </label>
          <span className="text-gray-600">{fileName || "선택된 파일 없음"}</span>
        </div>
        {isLoading && <p className="text-blue-600 mt-4">파일을 처리 중입니다...</p>}
        {error && <p className="text-red-600 mt-4">{error}</p>}
        <p className="text-sm text-gray-500 mt-4">
          엑셀 파일의 첫 번째 행은 헤더로 인식되어 건너뜁니다.<br/>
          컬럼 순서: 이용인 이름, 이용인 생년월일, 서비스 시작 시간, 서비스 종료 시간, 활동지원사 이름, 활동지원사 생년월일
        </p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">업로드된 내역 ({retroactiveData.length}건)</h2>
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3">이용인 이름</th>
                <th scope="col" className="px-6 py-3">이용인 생년월일</th>
                <th scope="col" className="px-6 py-3">서비스 시작</th>
                <th scope="col" className="px-6 py-3">서비스 종료</th>
                <th scope="col" className="px-6 py-3">활동지원사 이름</th>
                <th scope="col" className="px-6 py-3">활동지원사 생년월일</th>
              </tr>
            </thead>
            <tbody>
              {retroactiveData.length > 0 ? (
                retroactiveData.map((item) => (
                  <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4">{item.clientName}</td>
                    <td className="px-6 py-4">{item.clientDob}</td>
                    <td className="px-6 py-4">{item.serviceStart}</td>
                    <td className="px-6 py-4">{item.serviceEnd}</td>
                    <td className="px-6 py-4">{item.workerName}</td>
                    <td className="px-6 py-4">{item.workerDob}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500">데이터가 없습니다. 엑셀 파일을 업로드해주세요.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
