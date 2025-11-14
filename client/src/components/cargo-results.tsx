import { type CargoTrackingResult, type BatchCargoResult, type FormTemplate } from "@shared/schema";
import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Check, X, Printer } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CustomManifestPreview } from "./custom-manifest-preview";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

interface CargoResultsProps {
  data: BatchCargoResult[];
  templates?: FormTemplate[];
  selectedTemplateId: string;
  onTemplateChange: (id: string) => void;
}

function CollapsibleSection({
  title,
  isOpen,
  onToggle,
  children,
  testId
}: {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  testId?: string;
}) {
  return (
    <section>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-xl font-bold text-foreground pb-2 mb-4 border-b hover-elevate active-elevate-2 rounded-md px-2 -mx-2"
        data-testid={testId}
      >
        <span>{title}</span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronDown className="w-5 h-5" />
        )}
      </button>
      {isOpen && children}
    </section>
  );
}

function InfoTable({ fields }: { fields: Array<{ label: string; value: string; testId?: string; highlight?: boolean }> }) {
  return (
    <table className="w-full border border-black">
      <tbody>
        {fields.map((field, idx) => (
          <tr key={field.testId || idx} className={idx < fields.length - 1 ? "border-b border-black" : ""}>
            <th className="bg-gray-100 text-black p-3 text-sm font-semibold text-left border-r border-black w-1/2">
              {field.label}
            </th>
            <td
              data-testid={field.testId ? `text-${field.testId}` : undefined}
              className={`bg-white text-black p-3 text-sm ${
                field.highlight ? "font-bold text-blue-600" : ""
              }`}
            >
              {field.value || "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ArrivalReportContent({ arrivalReport }: { arrivalReport: CargoTrackingResult["arrivalReport"] }) {
  const fields = [
    { label: "제출번호", value: arrivalReport.submitNumber },
    { label: "보고일자", value: arrivalReport.reportDate },
    { label: "선박명", value: arrivalReport.shipName },
    { label: "선박국적", value: arrivalReport.shipNationality },
    { label: "국제총톤수", value: arrivalReport.grossTonnage },
    { label: "선박종류", value: arrivalReport.shipType },
    { label: "입항목적", value: arrivalReport.arrivalPurpose },
    { label: "항해구분", value: arrivalReport.voyageType },
    { label: "선사/대리점명", value: arrivalReport.carrierAgentName },
    { label: "승인일시", value: arrivalReport.approvalDateTime },
    { label: "CIQ수속일시", value: arrivalReport.ciqDateTime },
    { label: "선박호출/IMO부호", value: arrivalReport.shipCallSign },
    { label: "입항일시", value: arrivalReport.arrivalDateTime },
    { label: "CIQ수속장소", value: arrivalReport.ciqLocation },
    { label: "선박계선장소", value: arrivalReport.berthingLocation },
  ];

  const col1 = fields.filter((_, i) => i % 2 === 0);
  const col2 = fields.filter((_, i) => i % 2 === 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
      <InfoTable fields={col1} />
      <InfoTable fields={col2} />
    </div>
  );
}

function VoyageHistoryContent({ voyageHistory }: { voyageHistory: CargoTrackingResult["voyageHistory"] }) {
  const fields = [
    { label: "최초출항지", value: voyageHistory.firstDeparturePort },
    { label: "전출항지", value: voyageHistory.previousDeparturePort },
    { label: "전출항지출항일시", value: voyageHistory.previousDepartureDateTime },
    { label: "경유지1", value: voyageHistory.stopover1 },
    { label: "경유지2", value: voyageHistory.stopover2 },
    { label: "경유지3", value: voyageHistory.stopover3 },
    { label: "경유지4", value: voyageHistory.stopover4 },
    { label: "경유지5", value: voyageHistory.stopover5 },
    { label: "당해년도입항횟수", value: voyageHistory.yearlyArrivalCount },
  ];

  const col1 = fields.filter((_, i) => i % 3 === 0);
  const col2 = fields.filter((_, i) => i % 3 === 1);
  const col3 = fields.filter((_, i) => i % 3 === 2);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
      <InfoTable fields={col1} />
      <InfoTable fields={col2} />
      <InfoTable fields={col3} />
    </div>
  );
}

function BerthingMovementContent({ berthingMovements }: { berthingMovements: CargoTrackingResult["berthingMovements"] }) {
  return (
    <div className="overflow-x-auto border border-black">
      <table className="min-w-full">
        <thead className="bg-gray-100">
          <tr>
            <th rowSpan={2} className="p-3 text-center text-xs font-semibold border-r border-b border-black text-black">제출차수</th>
            <th className="p-3 text-center text-xs font-semibold border-r border-b border-black text-black">신고인</th>
            <th className="p-3 text-center text-xs font-semibold border-r border-b border-black text-black">신고일자</th>
            <th className="p-3 text-center text-xs font-semibold border-r border-b border-black text-black">변경전정박장소</th>
            <th rowSpan={2} className="p-3 text-center text-xs font-semibold border-b border-black text-black">이동사유</th>
          </tr>
          <tr>
            <th colSpan={2} className="p-3 text-center text-xs font-semibold border-r border-b border-black text-black">이동 예정일</th>
            <th className="p-3 text-center text-xs font-semibold border-r border-b border-black text-black">변경후정박장소</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {berthingMovements.length > 0 ? (
            berthingMovements.map((movement, idx) => (
              <tr key={idx} className={idx < berthingMovements.length - 1 ? "border-b border-black" : ""}>
                <td className="p-3 text-sm text-center border-r border-black text-black">{movement.no}</td>
                <td className="p-3 text-sm text-center border-r border-black text-black">{movement.declarer}</td>
                <td className="p-3 text-sm text-center border-r border-black text-black">{movement.declarationDate}</td>
                <td className="p-3 text-sm text-center border-r border-black text-black">{movement.previousBerthing}</td>
                <td className="p-3 text-sm text-center border-r border-black text-black">{movement.newBerthing}</td>
                <td className="p-3 text-sm text-center text-black">{movement.movementReason}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="p-3 text-center text-gray-500">
                조회결과가 존재하지 않습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SingleCargoResult({ 
  item, 
  templates, 
  selectedTemplateId, 
  onTemplateChange 
}: { 
  item: BatchCargoResult;
  templates?: FormTemplate[];
  selectedTemplateId: string;
  onTemplateChange: (id: string) => void;
}) {
  const [showDetailedInfo, setShowDetailedInfo] = useState(false);
  const [showArrivalSection, setShowArrivalSection] = useState(false);

  const itemNo = item.manifest?.itemNo || item.input.match(/Item No: ([^)]+)/)?.[1] || "-";
  const hasData = !!item.result;

  return (
    <div className="space-y-8" data-testid="results-container">
      {/* 상태 헤더 */}
      <div className={`flex items-center gap-3 p-4 rounded-md border-2 ${
        hasData 
          ? "bg-green-50 border-green-500" 
          : "bg-red-50 border-red-500"
      }`}>
        {hasData ? (
          <>
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500 text-white flex-shrink-0">
              <Check className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-green-800">
                Item No: {itemNo} - 조회 성공
              </div>
              <div className="text-sm text-green-700">
                Unipass API에서 화물 정보를 성공적으로 가져왔습니다.
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500 text-white flex-shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="font-bold text-red-800">
                Item No: {itemNo} - 조회 실패
              </div>
              <div className="text-sm text-red-700">
                유니패스 API에서 해당 B/L 번호의 화물 데이터를 찾을 수 없습니다.
              </div>
            </div>
          </>
        )}
      </div>

      {hasData && item.result && (
        <>
          {item.manifest && (
            <section>
              <div className="pb-2 mb-4 border-b flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">
                  화물표 미리보기
                </h2>
                {templates && templates.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">양식 선택:</span>
                    <Select value={selectedTemplateId} onValueChange={onTemplateChange}>
                      <SelectTrigger className="w-[200px]" data-testid="select-template">
                        <SelectValue placeholder="양식을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id.toString()} data-testid={`template-${template.id}`}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {(() => {
                const selectedTemplate = templates?.find(t => t.id.toString() === selectedTemplateId);
                return selectedTemplate ? (
                  <CustomManifestPreview data={item.manifest} template={selectedTemplate} />
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    양식을 선택해주세요. 양식이 없다면 <a href="/templates" className="text-primary underline">양식 관리</a>에서 먼저 양식을 만들어주세요.
                  </div>
                );
              })()}
            </section>
          )}

          <CollapsibleSection
            title="상세 조회 정보"
            isOpen={showDetailedInfo}
            onToggle={() => setShowDetailedInfo(!showDetailedInfo)}
            testId="detailed-info-toggle"
          >
            <div className="space-y-8">
              <BasicInfoSection basicInfo={item.result.basicInfo} />
              <ContainerSection containers={item.result.containers} />
              
              <CollapsibleSection
                title="입항보고 / 항해기록 / 항내 정박장소 이동신고"
                isOpen={showArrivalSection}
                onToggle={() => setShowArrivalSection(!showArrivalSection)}
                testId="arrival-section-toggle"
              >
                <div className="space-y-8">
                  <section>
                    <h3 className="text-lg font-bold text-foreground pb-2 mb-4 border-b">입항보고 내역</h3>
                    <ArrivalReportContent arrivalReport={item.result.arrivalReport} />
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-foreground pb-2 mb-4 border-b">항해기록</h3>
                    <VoyageHistoryContent voyageHistory={item.result.voyageHistory} />
                  </section>

                  <section>
                    <h3 className="text-lg font-bold text-foreground pb-2 mb-4 border-b">항내 정박장소 이동신고</h3>
                    <BerthingMovementContent berthingMovements={item.result.berthingMovements} />
                  </section>
                </div>
              </CollapsibleSection>

              <ProgressDetailsSection progressDetails={item.result.progressDetails} />
            </div>
          </CollapsibleSection>
        </>
      )}

      {!hasData && item.manifest && (
        <section>
          <div className="pb-2 mb-4 border-b flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">
              화물표 (입고리스트 정보)
            </h2>
            {templates && templates.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">양식 선택:</span>
                <Select value={selectedTemplateId} onValueChange={onTemplateChange}>
                  <SelectTrigger className="w-[200px]" data-testid="select-template-fallback">
                    <SelectValue placeholder="양식을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()} data-testid={`template-fallback-${template.id}`}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="bg-yellow-50 border border-yellow-200 p-4 mb-4 text-sm">
            <span className="font-semibold">Unipass API 조회는 실패했지만, 입고리스트의 기본 정보로 화물표를 생성했습니다.</span>
          </div>
          {(() => {
            const selectedTemplate = templates?.find(t => t.id.toString() === selectedTemplateId);
            return selectedTemplate ? (
              <CustomManifestPreview data={item.manifest} template={selectedTemplate} />
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                양식을 선택해주세요. 양식이 없다면 <a href="/templates" className="text-primary underline">양식 관리</a>에서 먼저 양식을 만들어주세요.
              </div>
            );
          })()}
        </section>
      )}
    </div>
  );
}

export function CargoResults({ data, templates, selectedTemplateId, onTemplateChange }: CargoResultsProps) {
  const [selectedBL, setSelectedBL] = useState<string>("");

  const extractBLNo = (input: string): string => {
    const match = input.match(/^(\d+|[A-Z]+\d+)/i);
    return match ? match[1] : input;
  };

  const getItemStats = (items: BatchCargoResult[]) => {
    const total = items.length;
    const success = items.filter(item => !!item.result).length;
    const fail = total - success;
    const successItems = items.filter(item => !!item.result).map(item => item.manifest?.itemNo || "-");
    const failItems = items.filter(item => !item.result).map(item => item.manifest?.itemNo || "-");
    return { total, success, fail, successItems, failItems };
  };

  // BL별로 그룹핑
  const groupedByBL = data.reduce((acc, item) => {
    const blNo = extractBLNo(item.input);
    if (!acc[blNo]) {
      acc[blNo] = [];
    }
    acc[blNo].push(item);
    return acc;
  }, {} as Record<string, BatchCargoResult[]>);

  const blNumbers = Object.keys(groupedByBL);

  useEffect(() => {
    if (blNumbers.length > 0 && !selectedBL) {
      setSelectedBL(blNumbers[0]);
    }
  }, [data]);

  if (data.length === 0) {
    return null;
  }

  const currentBL = selectedBL || blNumbers[0];
  const currentItems = groupedByBL[currentBL] || [];
  const currentStats = getItemStats(currentItems);

  return (
    <div className="h-full flex flex-col">
      {/* 상단 Item 선택 영역 - 고정 */}
      <div className="flex-shrink-0 p-6 pb-4">
        {blNumbers.length > 1 && (
          <div className="mb-2">
            <div className="flex flex-wrap gap-2">
              {blNumbers.map((blNo) => {
                const stats = getItemStats(groupedByBL[blNo]);
                const hasFail = stats.fail > 0;
                const originalBL = groupedByBL[blNo][0]?.manifest?.blNo || blNo;
                return (
                  <button
                    key={blNo}
                    onClick={() => setSelectedBL(blNo)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md border-2 transition-all hover-elevate active-elevate-2 ${
                      currentBL === blNo
                        ? hasFail
                          ? "border-red-500 bg-red-50 text-red-700 font-semibold opacity-100"
                          : "border-primary bg-primary/10 text-primary font-semibold opacity-100"
                        : hasFail
                        ? "border-red-300 bg-card text-red-600 opacity-50"
                        : "border-border bg-card text-foreground opacity-50"
                    }`}
                    data-testid={`tab-bl-${blNo}`}
                  >
                    <span className="font-mono text-sm font-semibold">
                      {originalBL}
                    </span>
                    <span className="text-xs flex items-center gap-1">
                      <span>({stats.total}개)</span>
                      <span className="flex items-center gap-0.5">
                        <Check className="w-3 h-3" />
                        <span>{stats.success}</span>
                      </span>
                      <span className="flex items-center gap-0.5">
                        <X className="w-3 h-3" />
                        <span>{stats.fail}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      
      {/* 화물표 내용 - 스크롤 */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <Card className="p-6">
          {blNumbers.length === 1 && (
            <div className="mb-6 pb-4 border-b space-y-3">
              <div className="flex items-center gap-3">
                <div className="font-mono text-lg font-semibold text-foreground">
                  {currentItems[0]?.manifest?.blNo || currentBL}
                </div>
                <div className="text-sm text-muted-foreground">
                  (총 {currentStats.total}개 항목: {currentStats.success}개 성공, {currentStats.fail}개 실패)
                </div>
              </div>
              {currentStats.success > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="font-semibold text-green-700 flex-shrink-0">✓ 성공:</span>
                  <span className="text-green-600">
                    {currentStats.successItems.join(', ')}
                  </span>
                </div>
              )}
              {currentStats.fail > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <span className="font-semibold text-red-700 flex-shrink-0">✗ 실패:</span>
                  <span className="text-red-600">
                    {currentStats.failItems.join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}
          
          <div className="space-y-12">
            {currentItems.map((item, index) => (
              <div key={index} className="border-b last:border-b-0 pb-12 last:pb-0">
                <SingleCargoResult 
                  item={item}
                  templates={templates}
                  selectedTemplateId={selectedTemplateId}
                  onTemplateChange={onTemplateChange}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function BasicInfoSection({ basicInfo }: { basicInfo: CargoTrackingResult["basicInfo"] }) {
  const leftFields = [
    { label: "화물관리번호", value: basicInfo.cargoId, testId: "cargo-id" },
    { label: "M B/L-H B/L", value: `${basicInfo.mblNo}${basicInfo.hblNo ? " - " + basicInfo.hblNo : ""}`, testId: "bl-no" },
    { label: "통관진행상태", value: basicInfo.status, testId: "status", highlight: true },
    { label: "품명", value: basicInfo.itemName, testId: "item-name" },
    { label: "포장개수", value: basicInfo.pkgCount, testId: "pkg-count" },
    { label: "용적", value: basicInfo.volume, testId: "volume" },
    { label: "관리대상검사여부", value: basicInfo.mgmtTarget, testId: "mgmt-target" },
    { label: "특수화물코드", value: basicInfo.specialCargo || "-", testId: "special-cargo" },
  ];

  const rightFields = [
    { label: "진행상태", value: basicInfo.progressStatus, testId: "progress-status", highlight: true },
    { label: "화물구분", value: basicInfo.cargoType, testId: "cargo-type" },
    { label: "처리일시", value: basicInfo.processDate, testId: "process-date" },
    { label: "선사/항공사", value: basicInfo.carrier, testId: "carrier" },
    { label: "선박/항공편명", value: basicInfo.shipName, testId: "ship-name" },
    { label: "선박국적", value: basicInfo.shipNat, testId: "ship-nat" },
    { label: "선박대리점", value: basicInfo.shipAgent, testId: "ship-agent" },
    { label: "적재항", value: basicInfo.loadingPort, testId: "loading-port" },
    { label: "총 중량", value: basicInfo.totalWeight, testId: "total-weight" },
    { label: "양륙항", value: basicInfo.unloadingPort, testId: "unloading-port" },
    { label: "입항세관", value: basicInfo.entranceCustoms, testId: "entrance-customs" },
    { label: "입항일", value: basicInfo.unloadingDate, testId: "entrance-date" },
    { label: "항차", value: basicInfo.voyageNo, testId: "voyage-no" },
    { label: "B/L유형", value: basicInfo.blType, testId: "bl-type" },
    { label: "컨테이너개수", value: basicInfo.containerNo ? "1" : "0", testId: "container-count" },
    { label: "반출의무과태료", value: basicInfo.dutyPeriodPass, testId: "duty-period-pass" },
    { label: "신고지연가산세", value: basicInfo.delayTax, testId: "delay-tax" },
    { label: "컨테이너번호", value: basicInfo.containerNo, testId: "container-no" },
    { label: "특송업체", value: basicInfo.expressCompany || "-", testId: "express-company" },
  ];

  return (
    <section>
      <div className="bg-gray-800 text-white p-3 font-semibold text-sm mb-2">
        기본 화물진행정보
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        <InfoTable fields={leftFields} />
        <InfoTable fields={rightFields} />
      </div>
    </section>
  );
}

function ContainerSection({ containers }: { containers: CargoTrackingResult["containers"] }) {
  return (
    <section>
      <div className="bg-gray-800 text-white p-3 font-semibold text-sm mb-2">
        컨테이너내역 조회
      </div>
      <div className="overflow-x-auto border border-black">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-center text-xs font-semibold border-r border-black text-black">No</th>
              <th className="p-3 text-center text-xs font-semibold border-r border-black text-black">컨테이너번호</th>
              <th className="p-3 text-center text-xs font-semibold border-r border-black text-black">컨테이너규격</th>
              <th className="p-3 text-center text-xs font-semibold border-r border-black text-black">봉인번호1</th>
              <th className="p-3 text-center text-xs font-semibold border-r border-black text-black">봉인번호2</th>
              <th className="p-3 text-center text-xs font-semibold text-black">봉인번호3</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {containers.length > 0 ? (
              containers.map((container, idx) => (
                <tr key={idx} className={idx < containers.length - 1 ? "border-b border-black" : ""} data-testid={`container-row-${idx}`}>
                  <td className="p-3 text-sm text-center border-r border-black text-black" data-testid={`container-no-${idx}`}>{container.no}</td>
                  <td className="p-3 text-sm text-center border-r border-black text-black" data-testid={`container-id-${idx}`}>{container.containerNo}</td>
                  <td className="p-3 text-sm text-center border-r border-black text-black">{container.spec || "-"}</td>
                  <td className="p-3 text-sm text-center border-r border-black text-black">{container.seal1 || "-"}</td>
                  <td className="p-3 text-sm text-center border-r border-black text-black">{container.seal2 || "-"}</td>
                  <td className="p-3 text-sm text-center text-black">{container.seal3 || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-3 text-center text-gray-500">
                  컨테이너 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProgressDetailsSection({ progressDetails }: { progressDetails: CargoTrackingResult["progressDetails"] }) {
  return (
    <section>
      <div className="bg-gray-800 text-white p-3 font-semibold text-sm mb-2">
        화물통관진행정보조회
      </div>
      <div className="bg-yellow-50 border border-yellow-200 p-3 mb-4 text-sm">
        <span className="font-semibold">위 이러한는 가장 일반적인 절차를 기준으로 작성되어 실물 반입 상황 변경 물품의 경우에 따라 소속등의 절차가 생략될 수 있습니다. 반드시 아래에 '처리구분'을 확인하시어 진단 전체경시가 바랍니다.</span>
      </div>
      <div className="text-sm text-gray-600 mb-2">
        전체 {progressDetails.length} 건
      </div>
      <div className="overflow-x-auto border border-black">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-center font-semibold border-r border-black text-black">No</th>
              <th className="p-2 text-center font-semibold border-r border-black text-black">처리구분</th>
              <th className="p-2 text-center font-semibold border-r border-black text-black">장치장/장치위치</th>
              <th className="p-2 text-center font-semibold border-r border-black text-black">포장개수</th>
              <th className="p-2 text-center font-semibold border-r border-black text-black">반출입/신고일시</th>
              <th className="p-2 text-center font-semibold text-black">선고번호</th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {progressDetails.length > 0 ? (
              progressDetails.map((detail, idx) => (
                <tr key={idx} className={idx < progressDetails.length - 1 ? "border-b border-black" : ""} data-testid={`progress-row-${idx}`}>
                  <td className="p-2 text-center align-top border-r border-black text-black" data-testid={`progress-no-${idx}`}>{detail.no}</td>
                  <td className="p-2 align-top border-r border-black text-black">
                    <div className="font-medium">{detail.processType}</div>
                    <div className="text-gray-500 mt-1">{detail.processDate}</div>
                  </td>
                  <td className="p-2 align-top border-r border-black text-black">
                    <div className="font-medium">{detail.location || "-"}</div>
                    <div className="text-gray-500 mt-1">{detail.locationCode || "-"}</div>
                  </td>
                  <td className="p-2 text-center align-top border-r border-black text-black">
                    <div>{detail.pkgCount || "0"}</div>
                    <div className="text-gray-500 mt-1">{detail.weight || "-"}</div>
                  </td>
                  <td className="p-2 align-top border-r border-black text-black">
                    <div>{detail.releaseDate || "-"}</div>
                    <div className="text-gray-500 mt-1">{detail.releaseInfo || "-"}</div>
                  </td>
                  <td className="p-2 align-top text-black">
                    <div className="break-all">{detail.declarationNo || "-"}</div>
                    {detail.additionalInfo && (
                      <div className="text-gray-500 mt-1 break-all">{detail.additionalInfo}</div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-3 text-center text-gray-500">
                  화물통관진행정보가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
