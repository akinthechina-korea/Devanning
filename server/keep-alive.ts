/**
 * Keep-Alive 스크립트
 * Render 무료 플랜의 15분 슬리프 모드 방지
 * 14분마다 서버에 자동 핑 요청
 */

import axios from 'axios';

export function startKeepAlive() {
  // 프로덕션 환경에서만 작동
  if (process.env.NODE_ENV !== "production") {
    console.log("ℹ️ Keep-Alive 비활성화 (프로덕션 환경이 아님)");
    return;
  }

  // RENDER_EXTERNAL_URL 또는 서비스 URL 확인
  const externalUrl = process.env.RENDER_EXTERNAL_URL || 
                     process.env.RENDER_SERVICE_URL ||
                     (process.env.PORT ? `http://localhost:${process.env.PORT}` : null);
  
  if (!externalUrl) {
    console.log("⚠️ RENDER_EXTERNAL_URL이 설정되지 않았습니다. Keep-Alive가 비활성화됩니다.");
    return;
  }

  // Health check 엔드포인트 사용 (더 가벼움)
  const healthCheckUrl = externalUrl.endsWith('/health') 
    ? externalUrl 
    : `${externalUrl}/health`;

  console.log(`✅ Keep-Alive 활성화: ${healthCheckUrl} (14분마다 핑)`);

  // 14분마다 핑 (840,000ms = 14 * 60 * 1000)
  const interval = 14 * 60 * 1000;

  const ping = async () => {
    try {
      const response = await axios.get(healthCheckUrl, {
        timeout: 5000,
        headers: {
          "User-Agent": "Render-KeepAlive/1.0",
        },
      });
      
      if (response.status === 200) {
        console.log(`✅ Keep-Alive 핑 성공: ${new Date().toISOString()}`);
      } else {
        console.log(`⚠️ Keep-Alive 핑 응답: ${response.status}`);
      }
    } catch (error: any) {
      // 에러는 로그만 남기고 계속 실행
      if (error.response) {
        console.log(`⚠️ Keep-Alive 핑 응답: ${error.response.status}`);
      } else {
        console.error(`❌ Keep-Alive 핑 실패:`, error.message || error);
      }
    }
  };

  // 즉시 한 번 실행 (서버 시작 후 첫 핑)
  setTimeout(() => {
    ping();
  }, 10000); // 10초 후 첫 핑 (서버가 완전히 시작된 후)

  // 주기적으로 실행 (14분마다)
  setInterval(ping, interval);
  
  console.log(`✅ Keep-Alive 스케줄 설정 완료 (첫 핑: 10초 후, 이후 14분마다)`);
}

