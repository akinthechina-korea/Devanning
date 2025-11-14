import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";

export interface User {
  id: number;
  username: string;
  role: "user" | "admin";
}

export function useAuth() {
  const [, setLocation] = useLocation();

  // 현재 사용자 정보 조회
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  // 로그아웃
  const logoutMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      // 모든 캐시 완전 초기화 (다른 사용자의 데이터가 표시되는 것 방지)
      queryClient.clear();
      // sessionStorage 초기화 (이전 사용자의 선택사항 제거)
      sessionStorage.removeItem('cargo-selected-bls');
      sessionStorage.removeItem('cargo-selected-items');
      sessionStorage.removeItem('cargo-search-results');
      // 로그인 페이지로 이동
      setLocation("/login");
    },
  });

  const logout = () => {
    logoutMutation.mutate();
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    isAdmin: user?.role === "admin",
    logout,
  };
}
