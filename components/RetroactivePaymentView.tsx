
import React, { useState, useMemo } from 'react';
import type { PaymentItem, Client } from '../types';
import { normalizeDob, formatDateTime } from '../utils/helpers';

interface RetroactivePaymentViewProps {
  allPayments: PaymentItem[];
  setAllPayments: React.Dispatch<React.SetStateAction<PaymentItem[]>>;
  clients: Client[];
  onBack: () => void;
}

declare const XLSX: any;

const TAB_YEARS = Array.from({ length: 7 }, (_, i) => 2024 + i); // 2024 ~ 2030

export const RetroactivePaymentView: React.FC<RetroactivePaymentViewProps> = ({ allPayments, setAllPayments, clients, onBack }) => {
  const [selectedYear, setSelectedYear] = useState<number>(2025);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // 1. 이상결제 내역 필터링
  const abnormalData = useMemo(() => {
    return allPayments.filter(item => {
        const itemDate = new Date(item.serviceStart);
        if (isNaN(itemDate.getTime()) || itemDate.getFullYear() !== selectedYear) return false;

        // 우선조건: 반납 또는 과오이면 제외
        if (item.returnType && (item.returnType.includes('반납') || item.returnType.includes('과오'))) return false;

        // 매칭 검증: 앱에 등록된 이용인(이름+생년월일)과 일치하는지 확인
        const matchedClient = clients.find(c => 
            c.name === item.clientName && normalizeDob(c.dob) === normalizeDob(item.clientDob)
        );

        // 등록되지 않은 이용인의 결제 내역이면 이상결제
        return !matchedClient;
    });
  }, [allPayments, selectedYear, clients]);

  // 2. 소급/예외 결제 내역 필터링
  const retroExceptionData = useMemo(() => {
    return allPayments.filter(item => {
        const itemDate = new Date(item.serviceStart);
        if (isNaN(itemDate.getTime()) || itemDate.getFullYear() !== selectedYear) return false;

        // 우선조건: 반납 또는 과오이면 제외
        if (item.returnType && (item.returnType.includes('반납') || item.returnType.includes('과오'))) return false;

        // 소급 또는 예외가 포함되어야 함
        return item.paymentType && (item.paymentType.includes('소급') || item.paymentType.includes('예외'));
    });
  }, [allPayments, selectedYear]);

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
        
        // Header row assumed at row 1 (index 0)
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        
        if (jsonData.length === 0) {
            throw new Error("데이터가 없습니다.");
        }

        // Dynamic Header Mapping
        // Find keys in the first row that contain our target keywords
        const firstRow = jsonData[0];
        const keys = Object.keys(firstRow);
        
        const findKey = (keyword: string) => keys.find(k => k.replace(/\s/g, '').includes(keyword));

        const colClientName = findKey('대상자명');
        const colClientDob = findKey('생년월일'); // Warning: Worker DOB also has '생년월일' usually?
        // Usually Excel has "대상자명", "생년월일", ... "제공인력명", "생년월일" <- duplicate keys handled by XLSX by appending _1
        // Let's look for specific patterns if possible or rely on order if keys are duplicate.
        // Better strategy: Search for '대상자' related keys and '제공인력' related keys.
        
        // Strict mapping based on user description "제공인력생년월일" in prompt implies the header is explicit.
        // If the header is just "생년월일" twice, sheet_to_json creates "생년월일" and "생년월일_1".
        // Let's try to be smart.
        
        // Re-read prompt: '대상자명' '생년월일' '서비스시작시간' '서비스종료시간' '제공인력명' '제공인력생년월일'
        // '제공인력생년월일' implies distinct header.
        
        const colServiceStart = findKey('서비스시작시간');
        const colServiceEnd = findKey('서비스종료시간');
        const colWorkerName = findKey('제공인력명');
        const colWorkerDob = findKey('제공인력생년월일') || keys.find(k => k.includes('생년월일') && k !== colClientDob); 
        
        const colPaymentType = findKey('결제구분');
        const colReturnType = findKey('반납구분');
        const colReason = findKey('소급결제사유') || findKey('사유');

        if (!colClientName || !colServiceStart) {
            throw new Error("필수 컬럼('대상자명', '서비스시작시간')을 찾을 수 없습니다. 엑셀 헤더를 확인해주세요.");
        }

        const formattedData: PaymentItem[] = jsonData.map((row: any, index: number) => {
            const serviceStartVal = row[colServiceStart!];
            if (!serviceStartVal) return null;

            const serviceStartDate = new Date(serviceStartVal);
            if (isNaN(serviceStartDate.getTime())) return null;

            // Filter by selected year
            if (serviceStartDate.getFullYear() !== selectedYear) return null;

            const clientName = String(row[colClientName!] || '').trim();
            const clientDob = normalizeDob(row[colClientDob!] || ''); // If Client DOB missing, might rely on matching later?
            
            // Handle duplicate '생년월일' issue if headers were identical
            // If XLSX produced '생년월일_1', findKey matches it?
            
            const workerName = colWorkerName ? String(row[colWorkerName] || '').trim() : '';
            const workerDob = colWorkerDob ? normalizeDob(row[colWorkerDob]) : '';

            const itemContent = JSON.stringify({
                clientName,
                clientDob,
                serviceStart: String(serviceStartVal),
                workerName,
                index // Add index to ensure uniqueness for same-time entries
            });
            
            // Simple hash for ID
            let hash = 0;
            for (let i = 0; i < itemContent.length; i++) {
                const char = itemContent.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash |= 0; 
            }

            return {
                id: String(hash + index + Date.now()),
                clientName,
                clientDob,
                serviceStart: String(serviceStartVal),
                serviceEnd: colServiceEnd ? String(row[colServiceEnd]) : '',
                workerName,
                workerDob,
                paymentType: colPaymentType ? String(row[colPaymentType] || '') : '',
                returnType: colReturnType ? String(row[colReturnType] || '') : '',
                reason: colReason ? String(row[colReason] || '') : '',
                month: serviceStartDate.getMonth(),
            };
        }).filter((item: PaymentItem | null): item is PaymentItem => item !== null);
        
        if (formattedData.length === 0) {
            setError(`${selectedYear}년도에 해당하는 유효한 데이터가 없습니다.`);
            setIsLoading(false);
            return;
        }

        // 반납구분이 '반납'인 것은 여기서 미리 제거하는 게 아니라,
        // 원본(allPayments)에는 다 저장하고 view에서 필터링하거나,
        // 여기서 제거하고 저장할 수도 있음.
        // Prompt requirement 3-(1): "반납구분에 반납이라고 적혀있으면 무조건 제외한다" (in filtering display).
        // It says "Data should be filtered like below".
        // Let's keep all data in memory (except explicit ignores) but filter for display.
        // Actually, to save memory and avoid confusion, let's include everything in state
        // but the 'setAllPayments' should probably REPLACE the year's data.

        setAllPayments(prev => {
            // Remove existing data for this year
            const otherYearsData = prev.filter(item => {
                const itemDate = new Date(item.serviceStart);
                return isNaN(itemDate.getTime()) || itemDate.getFullYear() !== selectedYear;
            });
            return [...otherYearsData, ...formattedData];
        });

        alert(`${selectedYear}년도 전체 내역 ${formattedData.length}건이 업로드되었습니다.`);

      } catch (err: any) {
        console.error(err);
        setError('파일 처리 중 오류: ' + err.message);
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
        <h1 className="text-3xl font-bold text-gray-800">결제 내역 관리</h1>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-4">연도별 전체 결제 내역 업로드</h2>
        
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
            <span>{selectedYear}년 엑셀 파일 업로드</span>
            <input 
                key={selectedYear}
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
            <li><b>{selectedYear}년도 전체 결제 내역</b> 엑셀 파일을 업로드해주세요.</li>
            <li>기존 해당 연도 데이터는 삭제되고 <b>새로운 데이터로 덮어씌워집니다.</b></li>
            <li>컬럼명(대상자명, 생년월일, 서비스시작시간 등)을 자동으로 인식합니다.</li>
          </ul>
        </div>
      </div>
      
      {/* 1. 이상결제 내역 섹션 */}
      <div className="bg-red-50 p-6 rounded-lg shadow-md mb-6 border border-red-200">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-red-700">⚠️ {selectedYear}년 이상결제 내역</h2>
            <span className="text-sm text-red-600 bg-white px-2 py-1 rounded border border-red-200">
                명단에 없는 이용자의 결제 기록
            </span>
        </div>
        
        <div className="overflow-x-auto max-h-[40vh]">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-red-100 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3">대상자명</th>
                <th scope="col" className="px-6 py-3">생년월일</th>
                <th scope="col" className="px-6 py-3">서비스 시작</th>
                <th scope="col" className="px-6 py-3">서비스 종료</th>
                <th scope="col" className="px-6 py-3">제공인력명</th>
                <th scope="col" className="px-6 py-3">제공인력 생년월일</th>
              </tr>
            </thead>
            <tbody>
              {abnormalData.length > 0 ? (
                abnormalData.map((item) => (
                  <tr key={item.id} className="bg-white border-b hover:bg-red-50">
                    <td className="px-6 py-4 font-bold text-red-600">{item.clientName}</td>
                    <td className="px-6 py-4">{item.clientDob}</td>
                    <td className="px-6 py-4">{formatDateTime(item.serviceStart)}</td>
                    <td className="px-6 py-4">{formatDateTime(item.serviceEnd)}</td>
                    <td className="px-6 py-4">{item.workerName}</td>
                    <td className="px-6 py-4">{item.workerDob}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500 font-medium">
                    이상결제 없음
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. 소급/예외 결제 내역 섹션 */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-800">{selectedYear}년 소급/예외 결제 내역 ({retroExceptionData.length}건)</h2>
        </div>
        
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0">
              <tr>
                <th scope="col" className="px-6 py-3">대상자명</th>
                <th scope="col" className="px-6 py-3">생년월일</th>
                <th scope="col" className="px-6 py-3">서비스 시작</th>
                <th scope="col" className="px-6 py-3">서비스 종료</th>
                <th scope="col" className="px-6 py-3">제공인력명</th>
                <th scope="col" className="px-6 py-3">제공인력 생년월일</th>
                <th scope="col" className="px-6 py-3">결제구분</th>
                <th scope="col" className="px-6 py-3">사유</th>
              </tr>
            </thead>
            <tbody>
              {retroExceptionData.length > 0 ? (
                retroExceptionData.map((item) => (
                  <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{item.clientName}</td>
                    <td className="px-6 py-4">{item.clientDob}</td>
                    <td className="px-6 py-4">{formatDateTime(item.serviceStart)}</td>
                    <td className="px-6 py-4">{formatDateTime(item.serviceEnd)}</td>
                    <td className="px-6 py-4">{item.workerName}</td>
                    <td className="px-6 py-4">{item.workerDob}</td>
                    <td className="px-6 py-4">
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                            {item.paymentType}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 max-w-xs truncate" title={item.reason}>
                        {item.reason}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500">
                    소급 또는 예외 결제 내역이 없습니다.
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
