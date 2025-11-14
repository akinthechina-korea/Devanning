import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Trash2 } from "lucide-react";
import { useLocation } from "wouter";

interface User {
  id: number;
  username: string;
  role: "user" | "admin";
  createdAt: string;
}

export default function AdminPage() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "user" as "user" | "admin",
  });

  // 관리자가 아니면 메인 페이지로 redirect (useEffect 사용)
  useEffect(() => {
    if (!isAdmin) {
      setLocation("/");
    }
  }, [isAdmin, setLocation]);

  // 관리자가 아닌 경우 null 반환 (redirect 전)
  if (!isAdmin) {
    return null;
  }

  // 사용자 목록 조회
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  // 사용자 추가
  const addUserMutation = useMutation({
    mutationFn: async (data: typeof newUser) => {
      return apiRequest("POST", "/api/admin/users", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsAddDialogOpen(false);
      setNewUser({ username: "", password: "", role: "user" });
      toast({
        title: "사용자 추가 완료",
        description: "새 사용자가 추가되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "사용자 추가 실패",
        description: error.message || "사용자 추가 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 사용자 삭제
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      return apiRequest("DELETE", `/api/admin/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "사용자 삭제 완료",
        description: "사용자가 삭제되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "사용자 삭제 실패",
        description: error.message || "사용자 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleAddUser = () => {
    if (!newUser.username || !newUser.password) {
      toast({
        title: "입력 오류",
        description: "사용자명과 비밀번호를 입력하세요.",
        variant: "destructive",
      });
      return;
    }
    addUserMutation.mutate(newUser);
  };

  const handleDeleteUser = (userId: number) => {
    if (confirm("정말 이 사용자를 삭제하시겠습니까?")) {
      deleteUserMutation.mutate(userId);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>사용자 관리</CardTitle>
                <CardDescription>
                  시스템 사용자 계정을 관리합니다.
                </CardDescription>
              </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-user">
                    <UserPlus className="mr-2 h-4 w-4" />
                    사용자 추가
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>새 사용자 추가</DialogTitle>
                    <DialogDescription>
                      새로운 사용자 계정을 생성합니다.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="username">사용자명</Label>
                      <Input
                        id="username"
                        value={newUser.username}
                        onChange={(e) =>
                          setNewUser({ ...newUser, username: e.target.value })
                        }
                        placeholder="사용자명을 입력하세요"
                        data-testid="input-new-username"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password">비밀번호</Label>
                      <Input
                        id="password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) =>
                          setNewUser({ ...newUser, password: e.target.value })
                        }
                        placeholder="비밀번호를 입력하세요"
                        data-testid="input-new-password"
                      />
                    </div>
                    <div>
                      <Label htmlFor="role">역할</Label>
                      <Select
                        value={newUser.role}
                        onValueChange={(value: "user" | "admin") =>
                          setNewUser({ ...newUser, role: value })
                        }
                      >
                        <SelectTrigger data-testid="select-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">사용자</SelectItem>
                          <SelectItem value="admin">관리자</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleAddUser}
                      disabled={addUserMutation.isPending}
                      data-testid="button-confirm-add-user"
                    >
                      {addUserMutation.isPending ? "추가 중..." : "추가"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>사용자명</TableHead>
                  <TableHead>역할</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((u) => (
                  <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                    <TableCell data-testid={`text-user-id-${u.id}`}>
                      {u.id}
                    </TableCell>
                    <TableCell data-testid={`text-username-${u.id}`}>
                      {u.username}
                    </TableCell>
                    <TableCell data-testid={`text-role-${u.id}`}>
                      {u.role === "admin" ? "관리자" : "사용자"}
                    </TableCell>
                    <TableCell data-testid={`text-created-${u.id}`}>
                      {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={
                          u.id === user?.id || deleteUserMutation.isPending
                        }
                        data-testid={`button-delete-user-${u.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {users?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                사용자가 없습니다.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
