import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, FileText, Edit, Trash2, Upload, Star } from "lucide-react";
import { type FormTemplate } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function TemplatesPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAdmin, isLoading: authLoading } = useAuth();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateToDelete, setTemplateToDelete] = useState<FormTemplate | null>(null);

  // 관리자가 아니면 redirect
  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast({
        title: "접근 권한 없음",
        description: "양식 관리 페이지는 관리자만 접근할 수 있습니다.",
        variant: "destructive",
      });
      setLocation("/");
    }
  }, [authLoading, isAdmin, setLocation, toast]);

  // 관리자일 때만 템플릿 목록 로드
  const { data: templates, isLoading } = useQuery<FormTemplate[]>({
    queryKey: ["/api/form-templates"],
    enabled: !authLoading && isAdmin,
  });

  // 로딩 중이거나 권한 없음
  if (authLoading || !isAdmin) {
    return null;
  }

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; structure: any }) => {
      const res = await apiRequest("POST", "/api/form-templates", data);
      return await res.json();
    },
    onSuccess: (data: FormTemplate) => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      toast({
        title: "양식 생성 완료",
        description: "새 양식이 생성되었습니다.",
      });
      setCreateDialogOpen(false);
      setTemplateName("");
      setLocation(`/template-editor/${data.id}`);
    },
    onError: () => {
      toast({
        title: "오류",
        description: "양식 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/form-templates/${id}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "삭제 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      toast({
        title: "삭제 완료",
        description: "양식이 삭제되었습니다.",
      });
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "삭제 실패",
        description: error.message || "양식 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/form-templates/${id}/set-default`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "기본 양식 설정 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      toast({
        title: "기본 양식 설정 완료",
        description: "선택한 양식이 기본 양식으로 설정되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "설정 실패",
        description: error.message || "기본 양식 설정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const createDefaultMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/form-templates/create-default");
      return await res.json();
    },
    onSuccess: (data: FormTemplate) => {
      queryClient.invalidateQueries({ queryKey: ["/api/form-templates"] });
      toast({
        title: "기본 양식 생성 완료",
        description: "기본 화물표 양식이 생성되었습니다.",
      });
      setLocation(`/template-editor/${data.id}`);
    },
    onError: () => {
      toast({
        title: "오류",
        description: "기본 양식 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      toast({
        title: "오류",
        description: "양식 이름을 입력하세요.",
        variant: "destructive",
      });
      return;
    }

    // 빈 이미지 기반 구조로 생성
    const structure = {
      templateImage: "",
      imageWidth: 800,
      imageHeight: 1000,
      fields: []
    };
    
    createMutation.mutate({ name: templateName, structure });
  };

  const handleDeleteClick = (template: FormTemplate) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!templateToDelete) return;
    deleteMutation.mutate(templateToDelete.id);
  };

  return (
    <div className="px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">양식 관리</h1>
          <p className="text-muted-foreground">
            화물표 이미지를 업로드하고 필드를 배치하여 커스텀 화물 검역표를 생성하세요.
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-template">
              <Plus className="mr-2 h-4 w-4" />
              새 양식 만들기
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 양식 만들기</DialogTitle>
              <DialogDescription>
                양식 이름을 입력하고 편집기에서 화물표 이미지를 업로드하세요.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="template-name">양식 이름</Label>
                <Input
                  id="template-name"
                  data-testid="input-template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="예: 커스텀 검역표"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setTemplateName("");
                }}
                data-testid="button-cancel-create"
              >
                취소
              </Button>
              <Button
                onClick={handleCreateTemplate}
                disabled={createMutation.isPending}
                data-testid="button-confirm-create"
              >
                <Plus className="mr-2 h-4 w-4" />
                {createMutation.isPending ? "생성 중..." : "만들기"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">양식 목록을 불러오는 중...</p>
        </div>
      ) : templates && templates.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="hover-elevate" data-testid={`card-template-${template.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-8 w-8 text-primary mb-2" />
                    {template.isDefault === 1 && (
                      <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => setDefaultMutation.mutate(template.id)}
                      disabled={template.isDefault === 1 || setDefaultMutation.isPending}
                      data-testid={`button-set-default-${template.id}`}
                      title={template.isDefault === 1 ? "현재 기본 양식입니다" : "기본 양식으로 설정"}
                    >
                      <Star className={`h-4 w-4 ${template.isDefault === 1 ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => setLocation(`/template-editor/${template.id}`)}
                      data-testid={`button-edit-${template.id}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => handleDeleteClick(template)}
                      disabled={templates && templates.length <= 1}
                      data-testid={`button-delete-${template.id}`}
                      title={
                        templates && templates.length <= 1 
                          ? "최소 1개의 양식은 유지되어야 합니다" 
                          : "양식 삭제"
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="flex items-center gap-2">
                  {template.name}
                </CardTitle>
                <CardDescription>
                  생성일: {new Date(template.createdAt).toLocaleDateString('ko-KR')}
                  {template.isDefault === 1 && (
                    <span className="ml-2 text-yellow-600 font-semibold">• 기본 양식</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full" 
                  onClick={() => setLocation(`/template-editor/${template.id}`)}
                  data-testid={`button-use-${template.id}`}
                >
                  이 양식 편집
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">저장된 양식이 없습니다</h3>
            <p className="text-muted-foreground mb-4">
              새 양식을 만들고 화물표 이미지를 업로드하여 시작하세요.
            </p>
            <Button 
              onClick={() => setCreateDialogOpen(true)}
              data-testid="button-create-first-template"
            >
              <Plus className="mr-2 h-4 w-4" />
              첫 양식 만들기
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-template">
          <DialogHeader>
            <DialogTitle>양식 삭제</DialogTitle>
            <DialogDescription>
              ⚠️ "{templateToDelete?.name}" 양식을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setTemplateToDelete(null);
              }}
              data-testid="button-cancel-delete"
            >
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
