
import React, { useState, useMemo } from 'react';
import type { RetroactivePaymentItem } from '../types';
import { normalizeDob, formatDateTime } from '../utils/helpers';

interface RetroactivePaymentViewProps {
  retroactiveData: RetroactivePaymentItem[];
  setRetroactiveData: React.Dispatch<React.SetStateAction<RetroactivePaymentItem[]>>;
  onBack: () => void;
}

declare const XLSX: any;

const TAB_YEARS = Array.from({ length: 7 }, (_, i) => 2024 + i); // 2024 ~ 2030

export const RetroactivePaymentView: React.FC<RetroactivePaymentViewProps> = ({ retroactiveData, setRetroactiveData, onBack }) => {
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 현재 탭 연도에 해당하는 데이터만 필터링
  const currentYearData = useMemo(() => {
    return retroactiveData.filter(item => {
        const itemDate = new Date(item.serviceStart);
        return !isNaN(itemDate.getTime()) && itemDate.getFullYear() === selectedYear;
    });
  }, [retroactiveData, selectedYear]);

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
          
          // 중요: 업로드된 데이터가 현재 선택된 탭(Year)에 맞는지 확인
          // (탭은 2025인데 2024 데이터를 올리면 제외하는 것이 안전)
          if (serviceStartDate.getFullYear() !== selectedYear) {
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
            id: String(hash + index + Date.now()), // Ensure uniqueness with timestamp
            clientName: String(row.clientName || ''),
            clientDob: clientDobNormalized,
            serviceStart: String(row.serviceStart || ''),
            serviceEnd: String(row.serviceEnd || ''),
            workerName: String(row.workerName || ''),
            workerDob: workerDobNormalized,
            month,
          };
        }).filter((item: RetroactivePaymentItem | null): item is RetroactivePaymentItem => item !== null);
        
        if (formattedData.length === 0) {
            setError(`${selectedYear}년도에 해당하는 데이터가 없습니다. 서비스 시작일을 확인해주세요.`);
            setIsLoading(false);
            return;
        }

        // 기존 데이터에서 선택된 연도 데이터를 모두 삭제하고, 새로운 데이터로 대체
        setRetroactiveData(prev => {
            const otherYearsData = prev.filter(item => {
                const itemDate = new Date(item.serviceStart);
                return isNaN(itemDate.getTime()) || itemDate.getFullYear() !== selectedYear;
            });
            return [...otherYearsData, ...formattedData];
        });

        alert(`${selectedYear}년도 소급결제 내역 ${formattedData.length}건이 성공적으로 업데이트되었습니다.`);

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
        <h2 className="text-xl font-semibold mb-4">연도 선택 및 엑셀 파일 업로드</h2>
        
        {/* Year Tabs */}
        <div className="flex space-x-2 border-b border-gray-200 mb-6 overflow-x-auto">
            {TAB_YEARS.map(year => (
                <button
                    key={year}
                    onClick={() => { setSelectedYear(year); setFileName(''); setError(''); }}
                    className={`py-2 px-4 font-medium text-sm transition-colors rounded-t-lg whitespace-nowrap ${
                        selectedYear === year 
                        ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-600' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                >
                    {year}년
                </button>
            ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-3 sm:space-y-0">
          <label className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg cursor-pointer transition-colors w-fit flex items-center justify-center">
            <span>{selectedYear}년 파일 업로드</span>
            <input 
                key={selectedYear} /* Force reset input on year change */
                type="file" 
                className="hidden" 
                accept=".xlsx, .xls" 
                onChange={handleFileUpload} 
            />
          </label>
          <span className="text-gray-600 text-sm">{fileName || "선택된 파일 없음"}</span>
        </div>
        
        {isLoading && <p className="text-blue-600 mt-4 animate-pulse">파일을 처리 중입니다...</p>}
        {error && <p className="text-red-600 mt-4 font-medium">⚠️ {error}</p>}
        
        <div className="mt-4 p-4 bg-gray-50 rounded text-sm text-gray-600">
          <ul className="list-disc ml-4 space-y-1">
            <li><b>{selectedYear}년</b> 탭을 선택하고 파일을 업로드하면, 기존의 <b>{selectedYear}년 데이터는 삭제되고 새 데이터로 대체</b>됩니다.</li>
            <li>엑셀의 '서비스 시작 시간'을 기준으로 연도를 판별합니다.</li>
            <li>엑셀 파일의 첫 번째 행은 헤더로 인식되어 건너뜁니다.</li>
            <li>컬럼 순서: 이용인 이름, 이용인 생년월일, 서비스 시작 시간, 서비스 종료 시간, 활동지원사 이름, 활동지원사 생년월일</li>
          </ul>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">{selectedYear}년 업로드된 내역 ({currentYearData.length}건)</h2>
        </div>
        
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
              {currentYearData.length > 0 ? (
                currentYearData.map((item) => (
                  <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{item.clientName}</td>
                    <td className="px-6 py-4">{item.clientDob}</td>
                    <td className="px-6 py-4">{formatDateTime(item.serviceStart)}</td>
                    <td className="px-6 py-4">{formatDateTime(item.serviceEnd)}</td>
                    <td className="px-6 py-4">{item.workerName}</td>
                    <td className="px-6 py-4">{item.workerDob}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500">
                    {selectedYear}년도 데이터가 없습니다. 엑셀 파일을 업로드해주세요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
