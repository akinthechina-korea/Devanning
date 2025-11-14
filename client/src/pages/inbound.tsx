import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Upload, Trash2, Edit } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { InboundList } from "@shared/schema";

// 엑셀 날짜 시리얼 번호를 날짜 문자열로 변환 (YYYY-MM-DD)
function excelSerialToDate(serial: string | null): string {
  if (!serial) return "-";
  const num = parseFloat(serial);
  if (isNaN(num)) return serial; // 숫자가 아니면 원본 반환
  
  // 엑셀 날짜 시리얼: 1900-01-01부터의 일수
  const date = new Date((num - 25569) * 86400 * 1000);
  
  // YYYY-MM-DD 형식으로 반환
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

export default function InboundPage() {
  const [file, setFile] = useState<File | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InboundList | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: inboundList, isLoading } = useQuery<InboundList[]>({
    queryKey: ["/api/inbound"],
    queryFn: async () => {
      const res = await fetch("/api/inbound", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch inbound list");
      return res.json();
    },
    refetchOnWindowFocus: true,
    enabled: !!user,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/inbound/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "업로드 실패");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "업로드 완료",
        description: data.message || "엑셀 파일이 성공적으로 업로드되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inbound"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbound/bl-list"] });
      setFile(null);
    },
    onError: (error: any) => {
      toast({
        title: "업로드 실패",
        description: error.message || "엑셀 파일 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (password: string) => {
      const res = await apiRequest("DELETE", "/api/inbound/reset", { password });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "초기화 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "초기화 완료",
        description: "모든 입고리스트 데이터가 삭제되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inbound"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbound/bl-list"] });
      setResetDialogOpen(false);
      setPassword("");
    },
    onError: (error: any) => {
      toast({
        title: "초기화 실패",
        description: error.message || "비밀번호가 올바르지 않습니다.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/inbound/${id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "업데이트 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "수정 완료",
        description: "입고리스트 항목이 수정되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/inbound"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbound/bl-list"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inbound/categories"] });
      setEditDialogOpen(false);
      setEditingItem(null);
      setEditFormData({});
    },
    onError: (error: any) => {
      toast({
        title: "수정 실패",
        description: error.message || "입고리스트 항목 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });


  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleReset = () => {
    if (!password.trim()) {
      toast({
        title: "오류",
        description: "비밀번호를 입력하세요.",
        variant: "destructive",
      });
      return;
    }
    resetMutation.mutate(password);
  };

  const handleEdit = (item: InboundList) => {
    setEditingItem(item);
    // 모든 필드 초기화
    setEditFormData({
      반입번호: item.반입번호 || "",
      no: item.no || "",
      도착Time: item.도착Time || "",
      출발Time: item.출발Time || "",
      도착예정Time: item.도착예정Time || "",
      blNo: item.blNo || "",
      itemNo: item.itemNo || "",
      dept: item.dept || "",
      description: item.description || "",
      qty: item.qty || "",
      qty_이상유무: item.qty_이상유무 || "",
      containerCntrNo: item.containerCntrNo || "",
      containerSealNo: item.containerSealNo || "",
      containerTemp: item.containerTemp || "",
      container_파손유무: item.container_파손유무 || "",
      palletQty: item.palletQty || "",
      mpk: item.mpk || "",
      box: item.box || "",
      unit: item.unit || "",
      palletType: item.palletType || "",
      제품확인_블록: item.제품확인_블록 || "",
      제품확인Coo: item.제품확인Coo || "",
      제품확인Remark: item.제품확인Remark || "",
      수작업_유형: item.수작업_유형 || "",
      차량번호: item.차량번호 || "",
      비고: item.비고 || "",
      구분: item.구분 || "",
      수입자: item.수입자 || "",
      costcoBlNo: item.costcoBlNo || "",
      tie: item.tie || "",
      높이: item.높이 || "",
      반입일자: item.반입일자 || "",
      plt: item.plt || "",
      매수: item.매수 || "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;
    
    // 빈 문자열을 null로 변환
    const cleanedData = Object.fromEntries(
      Object.entries(editFormData).map(([key, value]) => [
        key,
        value === "" ? null : value
      ])
    );
    
    updateMutation.mutate({ id: editingItem.id, data: cleanedData });
  };

  return (
    <div className="w-full p-6">
      <Card data-testid="card-list">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>입고리스트 ({inboundList?.length || 0}개)</CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={() => setResetDialogOpen(true)}
                variant="outline"
                data-testid="button-reset"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                초기화
              </Button>
              <Button
                onClick={handleUploadClick}
                disabled={uploadMutation.isPending}
                data-testid="button-upload"
              >
                <Upload className="mr-2 h-4 w-4" />
                {uploadMutation.isPending ? "업로드 중..." : "엑셀 업로드"}
              </Button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-file"
          />
        </CardHeader>
        <CardContent className="max-h-[calc(100vh-12rem)] overflow-auto">
          {isLoading ? (
            <p data-testid="text-loading">로딩 중...</p>
          ) : !inboundList || inboundList.length === 0 ? (
            <p className="text-muted-foreground" data-testid="text-empty">
              등록된 입고리스트가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap sticky left-0 bg-background">작업</TableHead>
                    <TableHead className="whitespace-nowrap">반입번호</TableHead>
                    <TableHead className="whitespace-nowrap">No.</TableHead>
                    <TableHead className="whitespace-nowrap">도착Time</TableHead>
                    <TableHead className="whitespace-nowrap">출발Time</TableHead>
                    <TableHead className="whitespace-nowrap">도착예정Time</TableHead>
                    <TableHead className="whitespace-nowrap">B/L No.</TableHead>
                    <TableHead className="whitespace-nowrap">item No.</TableHead>
                    <TableHead className="whitespace-nowrap">Dept</TableHead>
                    <TableHead className="whitespace-nowrap">Description</TableHead>
                    <TableHead className="whitespace-nowrap">QTY</TableHead>
                    <TableHead className="whitespace-nowrap">QTY_이상유무</TableHead>
                    <TableHead className="whitespace-nowrap">CONTAINER_Cntr No.</TableHead>
                    <TableHead className="whitespace-nowrap">CONTAINER_Seal No.</TableHead>
                    <TableHead className="whitespace-nowrap">CONTAINER_TEMP</TableHead>
                    <TableHead className="whitespace-nowrap">CONTAINER_파손유무</TableHead>
                    <TableHead className="whitespace-nowrap">Pallet Q'ty</TableHead>
                    <TableHead className="whitespace-nowrap">MPK</TableHead>
                    <TableHead className="whitespace-nowrap">BOX</TableHead>
                    <TableHead className="whitespace-nowrap">UNIT</TableHead>
                    <TableHead className="whitespace-nowrap">Pallet type</TableHead>
                    <TableHead className="whitespace-nowrap">제품확인_블록</TableHead>
                    <TableHead className="whitespace-nowrap">제품확인_COO</TableHead>
                    <TableHead className="whitespace-nowrap">제품확인_Remark</TableHead>
                    <TableHead className="whitespace-nowrap">수작업_유형</TableHead>
                    <TableHead className="whitespace-nowrap">차량번호</TableHead>
                    <TableHead className="whitespace-nowrap">비고</TableHead>
                    <TableHead className="whitespace-nowrap">구분</TableHead>
                    <TableHead className="whitespace-nowrap">수입자</TableHead>
                    <TableHead className="whitespace-nowrap">Costco B/L No.</TableHead>
                    <TableHead className="whitespace-nowrap">TIE</TableHead>
                    <TableHead className="whitespace-nowrap">높이</TableHead>
                    <TableHead className="whitespace-nowrap">반입일자</TableHead>
                    <TableHead className="whitespace-nowrap">PLT</TableHead>
                    <TableHead className="whitespace-nowrap">매수</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inboundList.map((item) => (
                    <TableRow key={item.id} data-testid={`row-inbound-${item.id}`}>
                      <TableCell className="whitespace-nowrap sticky left-0 bg-background">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(item)}
                          data-testid={`button-edit-${item.id}`}
                          disabled={user?.id !== item.userId}
                          title={user?.id !== item.userId ? "본인이 업로드한 항목만 수정할 수 있습니다" : "수정"}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{excelSerialToDate(item.반입번호)}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.no || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.도착Time || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.출발Time || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.도착예정Time || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap" data-testid={`text-bl-${item.id}`}>{item.blNo || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.itemNo || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.dept || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap" data-testid={`text-name-${item.id}`}>{item.description || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap" data-testid={`text-quantity-${item.id}`}>{item.qty || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.qty_이상유무 || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.containerCntrNo || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.containerSealNo || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.containerTemp || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.container_파손유무 || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.palletQty || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.mpk || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.box || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.unit || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.palletType || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.제품확인_블록 || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.제품확인Coo || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.제품확인Remark || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.수작업_유형 || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.차량번호 || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.비고 || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.구분 || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap" data-testid={`text-importer-${item.id}`}>{item.수입자 || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.costcoBlNo || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.tie || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.높이 || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {item.반입일자 ? (typeof item.반입일자 === 'string' && item.반입일자.includes('-') ? item.반입일자 : excelSerialToDate(item.반입일자 as any)) : '-'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{item.plt || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{item.매수 || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent data-testid="dialog-reset">
          <DialogHeader>
            <DialogTitle>입고리스트 초기화</DialogTitle>
            <DialogDescription>
              ⚠️ 모든 입고리스트 데이터가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="password">비밀번호</Label>
              <Input
                id="password"
                type="password"
                data-testid="input-reset-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleReset();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResetDialogOpen(false);
                setPassword("");
              }}
              data-testid="button-cancel-reset"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetMutation.isPending}
              data-testid="button-confirm-reset"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {resetMutation.isPending ? "삭제 중..." : "초기화"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-edit">
          <DialogHeader>
            <DialogTitle>입고리스트 수정</DialogTitle>
            <DialogDescription>
              수정할 필드를 변경하고 저장 버튼을 클릭하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div>
              <Label htmlFor="edit-반입번호">반입번호</Label>
              <Input
                id="edit-반입번호"
                data-testid="input-edit-반입번호"
                value={editFormData.반입번호 || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 반입번호: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-no">No.</Label>
              <Input
                id="edit-no"
                data-testid="input-edit-no"
                value={editFormData.no || ""}
                onChange={(e) => setEditFormData({ ...editFormData, no: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-도착Time">도착Time</Label>
              <Input
                id="edit-도착Time"
                data-testid="input-edit-도착Time"
                value={editFormData.도착Time || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 도착Time: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-출발Time">출발Time</Label>
              <Input
                id="edit-출발Time"
                data-testid="input-edit-출발Time"
                value={editFormData.출발Time || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 출발Time: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-도착예정Time">도착예정Time</Label>
              <Input
                id="edit-도착예정Time"
                data-testid="input-edit-도착예정Time"
                value={editFormData.도착예정Time || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 도착예정Time: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-blNo">B/L No.</Label>
              <Input
                id="edit-blNo"
                data-testid="input-edit-blNo"
                value={editFormData.blNo || ""}
                onChange={(e) => setEditFormData({ ...editFormData, blNo: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-itemNo">Item No.</Label>
              <Input
                id="edit-itemNo"
                data-testid="input-edit-itemNo"
                value={editFormData.itemNo || ""}
                onChange={(e) => setEditFormData({ ...editFormData, itemNo: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-dept">Dept</Label>
              <Input
                id="edit-dept"
                data-testid="input-edit-dept"
                value={editFormData.dept || ""}
                onChange={(e) => setEditFormData({ ...editFormData, dept: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                data-testid="input-edit-description"
                value={editFormData.description || ""}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-qty">QTY</Label>
              <Input
                id="edit-qty"
                data-testid="input-edit-qty"
                value={editFormData.qty || ""}
                onChange={(e) => setEditFormData({ ...editFormData, qty: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-qty_이상유무">QTY_이상유무</Label>
              <Input
                id="edit-qty_이상유무"
                data-testid="input-edit-qty_이상유무"
                value={editFormData.qty_이상유무 || ""}
                onChange={(e) => setEditFormData({ ...editFormData, qty_이상유무: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-containerCntrNo">CONTAINER_Cntr No.</Label>
              <Input
                id="edit-containerCntrNo"
                data-testid="input-edit-containerCntrNo"
                value={editFormData.containerCntrNo || ""}
                onChange={(e) => setEditFormData({ ...editFormData, containerCntrNo: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-containerSealNo">CONTAINER_Seal No.</Label>
              <Input
                id="edit-containerSealNo"
                data-testid="input-edit-containerSealNo"
                value={editFormData.containerSealNo || ""}
                onChange={(e) => setEditFormData({ ...editFormData, containerSealNo: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-containerTemp">CONTAINER_TEMP</Label>
              <Input
                id="edit-containerTemp"
                data-testid="input-edit-containerTemp"
                value={editFormData.containerTemp || ""}
                onChange={(e) => setEditFormData({ ...editFormData, containerTemp: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-container_파손유무">CONTAINER_파손유무</Label>
              <Input
                id="edit-container_파손유무"
                data-testid="input-edit-container_파손유무"
                value={editFormData.container_파손유무 || ""}
                onChange={(e) => setEditFormData({ ...editFormData, container_파손유무: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-palletQty">Pallet Q'ty</Label>
              <Input
                id="edit-palletQty"
                data-testid="input-edit-palletQty"
                value={editFormData.palletQty || ""}
                onChange={(e) => setEditFormData({ ...editFormData, palletQty: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-mpk">MPK</Label>
              <Input
                id="edit-mpk"
                data-testid="input-edit-mpk"
                value={editFormData.mpk || ""}
                onChange={(e) => setEditFormData({ ...editFormData, mpk: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-box">BOX</Label>
              <Input
                id="edit-box"
                data-testid="input-edit-box"
                value={editFormData.box || ""}
                onChange={(e) => setEditFormData({ ...editFormData, box: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-unit">UNIT</Label>
              <Input
                id="edit-unit"
                data-testid="input-edit-unit"
                value={editFormData.unit || ""}
                onChange={(e) => setEditFormData({ ...editFormData, unit: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-palletType">Pallet type</Label>
              <Input
                id="edit-palletType"
                data-testid="input-edit-palletType"
                value={editFormData.palletType || ""}
                onChange={(e) => setEditFormData({ ...editFormData, palletType: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-제품확인_블록">제품확인_블록</Label>
              <Input
                id="edit-제품확인_블록"
                data-testid="input-edit-제품확인_블록"
                value={editFormData.제품확인_블록 || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 제품확인_블록: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-제품확인Coo">제품확인_COO</Label>
              <Input
                id="edit-제품확인Coo"
                data-testid="input-edit-제품확인Coo"
                value={editFormData.제품확인Coo || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 제품확인Coo: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-제품확인Remark">제품확인_Remark</Label>
              <Input
                id="edit-제품확인Remark"
                data-testid="input-edit-제품확인Remark"
                value={editFormData.제품확인Remark || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 제품확인Remark: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-수작업_유형">수작업_유형</Label>
              <Input
                id="edit-수작업_유형"
                data-testid="input-edit-수작업_유형"
                value={editFormData.수작업_유형 || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 수작업_유형: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-차량번호">차량번호</Label>
              <Input
                id="edit-차량번호"
                data-testid="input-edit-차량번호"
                value={editFormData.차량번호 || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 차량번호: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="edit-비고">비고</Label>
              <Textarea
                id="edit-비고"
                data-testid="input-edit-비고"
                value={editFormData.비고 || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 비고: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-구분">구분</Label>
              <Input
                id="edit-구분"
                data-testid="input-edit-구분"
                value={editFormData.구분 || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 구분: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-수입자">수입자</Label>
              <Input
                id="edit-수입자"
                data-testid="input-edit-수입자"
                value={editFormData.수입자 || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 수입자: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-costcoBlNo">Costco B/L No.</Label>
              <Input
                id="edit-costcoBlNo"
                data-testid="input-edit-costcoBlNo"
                value={editFormData.costcoBlNo || ""}
                onChange={(e) => setEditFormData({ ...editFormData, costcoBlNo: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-tie">TIE</Label>
              <Input
                id="edit-tie"
                data-testid="input-edit-tie"
                value={editFormData.tie || ""}
                onChange={(e) => setEditFormData({ ...editFormData, tie: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-높이">높이</Label>
              <Input
                id="edit-높이"
                data-testid="input-edit-높이"
                value={editFormData.높이 || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 높이: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-반입일자">반입일자 (YYYY-MM-DD)</Label>
              <Input
                id="edit-반입일자"
                type="date"
                data-testid="input-edit-반입일자"
                value={editFormData.반입일자 || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 반입일자: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-plt">PLT</Label>
              <Input
                id="edit-plt"
                data-testid="input-edit-plt"
                value={editFormData.plt || ""}
                onChange={(e) => setEditFormData({ ...editFormData, plt: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-매수">매수</Label>
              <Input
                id="edit-매수"
                data-testid="input-edit-매수"
                value={editFormData.매수 || ""}
                onChange={(e) => setEditFormData({ ...editFormData, 매수: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setEditingItem(null);
                setEditFormData({});
              }}
              data-testid="button-cancel-edit"
            >
              취소
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
              data-testid="button-save-edit"
            >
              {updateMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
