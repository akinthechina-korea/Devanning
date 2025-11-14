import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "사용자명을 입력하세요"),
  password: z.string().min(1, "비밀번호를 입력하세요"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      const res = await apiRequest("POST", "/api/auth/login", data);
      return res.json();
    },
    onSuccess: async (response: any) => {
      console.log("=== 로그인 성공 ===");
      console.log("response:", response);
      console.log("role:", response?.role);
      
      // 인증 상태 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      
      toast({
        title: "로그인 성공",
        description: "환영합니다!",
      });
      
      // 사용자 역할에 따라 다른 페이지로 이동
      // 관리자 → 사용자 관리 페이지 (/admin)
      // 일반 사용자 → 메인 페이지 (/)
      const targetPath = response?.role === "admin" ? "/admin" : "/";
      console.log("이동할 경로:", targetPath);
      setLocation(targetPath);
      console.log("setLocation 호출 완료");
    },
    onError: (error: any) => {
      toast({
        title: "로그인 실패",
        description: error.message || "사용자명 또는 비밀번호가 올바르지 않습니다.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      await loginMutation.mutateAsync(data);
    } catch (error) {
      // 에러는 onError에서 처리됨 (toast 표시)
      // 여기서는 에러를 조용히 처리하여 브라우저 콘솔에 표시되지 않도록 함
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md px-4">
          <div className="flex flex-col items-center mb-8">
            <ClipboardList className="h-12 w-12 text-primary mb-4" />
            <h1 className="text-2xl font-bold text-foreground">디베이닝 마스터</h1>
            <p className="text-sm text-muted-foreground mt-2">수입화물[검역]표 일괄처리</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>로그인</CardTitle>
              <CardDescription>
                시스템에 접근하려면 로그인하세요
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>사용자명</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="사용자명을 입력하세요"
                            {...field}
                            autoFocus
                            data-testid="input-username"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>비밀번호</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="비밀번호를 입력하세요"
                            {...field}
                            data-testid="input-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                    data-testid="button-submit"
                  >
                    {isLoading ? "로그인 중..." : "로그인"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <footer className="border-t bg-background py-4">
        <div className="px-6 text-center text-sm text-muted-foreground">
          2025 ©CHUNIL.Copyright All Rights Reserved{" "}
          <a 
            href="http://www.chunilkor.co.kr" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
            data-testid="link-company-website"
          >
            www.chunilkor.co.kr
          </a>
        </div>
      </footer>
    </div>
  );
}
