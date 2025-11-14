import { useEffect, useState } from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import Home from "@/pages/home";
import InboundPage from "@/pages/inbound";
import TemplatesPage from "@/pages/templates";
import TemplateEditorPage from "@/pages/template-editor";
import LoginPage from "@/pages/login";
import AdminPage from "./pages/admin";
import NotFound from "@/pages/not-found";
import { useAuth } from "@/hooks/use-auth";
import { Package, Search, FileText, Printer, ClipboardList, LogOut, Settings } from "lucide-react";

function Router() {
  const [location, setLocation] = useLocation();
  const [hasResults, setHasResults] = useState(false);
  const { user, isLoading, isAuthenticated, isAdmin, logout } = useAuth();

  // 로그인 체크 - 로그인하지 않으면 로그인 페이지로 redirect
  useEffect(() => {
    if (!isLoading && !isAuthenticated && location !== "/login") {
      setLocation("/login");
    }
    // 이미 로그인된 사용자가 로그인 페이지에 접근하면 적절한 페이지로 redirect
    if (!isLoading && isAuthenticated && location === "/login") {
      // 관리자는 사용자 관리 페이지로, 일반 사용자는 화물 조회 페이지로
      setLocation(isAdmin ? "/admin" : "/");
    }
  }, [isLoading, isAuthenticated, isAdmin, location, setLocation]);

  // sessionStorage에서 검색 결과 확인
  useEffect(() => {
    const checkResults = () => {
      const results = sessionStorage.getItem('cargo-search-results');
      setHasResults(!!results && results !== 'null');
    };

    checkResults();
    
    // sessionStorage 변경 감지
    const interval = setInterval(checkResults, 500);
    return () => clearInterval(interval);
  }, []);


  const handleBatchPrint = () => {
    // Home 페이지로 이벤트 전송
    window.dispatchEvent(new CustomEvent('open-batch-print'));
  };

  // 로그인 페이지는 별도 렌더링
  if (location === "/login") {
    return <LoginPage />;
  }

  // 로딩 중
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg">로딩 중...</div>
        </div>
      </div>
    );
  }

  // 로그인하지 않은 경우 (redirect 전)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">디베이닝 마스터</h1>
              <span className="text-sm text-muted-foreground ml-4">
                {user?.username} ({user?.role === "admin" ? "관리자" : "사용자"})
              </span>
            </div>
            <nav className="flex gap-4 items-center">
              {location === "/" && hasResults && (
                <Button
                  onClick={handleBatchPrint}
                  variant="ghost"
                  data-testid="button-batch-print-open"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  일괄 인쇄 / PDF 저장
                </Button>
              )}
              {isAdmin && (
                <Link href="/templates">
                  <Button 
                    variant={location.startsWith("/templates") || location.startsWith("/template-editor") ? "default" : "ghost"}
                    data-testid="link-templates"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    양식
                  </Button>
                </Link>
              )}
              {!isAdmin && (
                <Link href="/inbound">
                  <Button 
                    variant={location === "/inbound" ? "default" : "ghost"}
                    data-testid="link-inbound"
                  >
                    <Package className="mr-2 h-4 w-4" />
                    입고리스트
                  </Button>
                </Link>
              )}
              {!isAdmin && (
                <Link href="/">
                  <Button 
                    variant={location === "/" ? "default" : "ghost"} 
                    data-testid="link-home"
                  >
                    <Search className="mr-2 h-4 w-4" />
                    화물 조회
                  </Button>
                </Link>
              )}
              {isAdmin && (
                <Link href="/admin">
                  <Button 
                    variant={location === "/admin" ? "default" : "ghost"}
                    data-testid="link-admin"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    사용자 관리
                  </Button>
                </Link>
              )}
              <Button 
                variant="ghost"
                onClick={logout}
                data-testid="button-logout"
              >
                <LogOut className="mr-2 h-4 w-4" />
                로그아웃
              </Button>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/inbound" component={InboundPage} />
          <Route path="/templates" component={TemplatesPage} />
          <Route path="/template-editor/new" component={TemplateEditorPage} />
          <Route path="/template-editor/:id" component={TemplateEditorPage} />
          <Route path="/admin" component={AdminPage} />
          <Route component={NotFound} />
        </Switch>
      </main>
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
